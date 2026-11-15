"""
app/services/link_safety.py — SSRF guard and bounded fetch for user-supplied links.

Every hop (including redirects) is checked: http/https only, standard ports, no
credentials in the URL, and every address the host resolves to must be public.
The body is capped and the whole fetch has a deadline.

Residual risk: DNS can change between our check and httpx's own lookup (rebinding).
This keeps the window to one request and re-checks each redirect hop.
"""
from __future__ import annotations

import ipaddress
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
import socket
import time
from urllib.parse import urljoin, urlparse

import httpx

MAX_BYTES = 1_500_000
MAX_REDIRECTS = 3
TOTAL_TIMEOUT_SECONDS = 8.0
ALLOWED_PORTS = {None, 80, 443}
ALLOWED_CONTENT_TYPES = ("text/html", "application/xhtml+xml", "text/plain")
USER_AGENT = "RovvyLinkReader/1.0 (+https://rovvy.app)"


class UnsafeLinkError(ValueError):
    """The link is not allowed to be fetched (message is safe to show the user)."""


def _is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or (isinstance(ip, ipaddress.IPv4Address) and ip in ipaddress.ip_network("100.64.0.0/10"))
    )


def assert_public_url(url: str) -> str:
    """Return the normalised URL or raise UnsafeLinkError."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeLinkError("Enter a valid http or https link.")
    if parsed.username or parsed.password:
        raise UnsafeLinkError("Links with a username or password are not allowed.")
    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsafeLinkError("That link has an invalid port.") from exc
    if port not in ALLOWED_PORTS:
        raise UnsafeLinkError("Only standard web ports are allowed.")

    host = parsed.hostname
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        addresses = [literal]
    else:
        if host.lower() in {"localhost"} or host.lower().endswith((".local", ".internal", ".localhost")):
            raise UnsafeLinkError("That address is not public.")
        try:
            infos = socket.getaddrinfo(host, port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise UnsafeLinkError("Could not find that website.") from exc
        addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not addresses or not all(_is_public_ip(a) for a in addresses):
        raise UnsafeLinkError("That address is not public.")
    return parsed.geturl()


def safe_fetch_text(url: str, *, client: httpx.Client | None = None) -> tuple[str, str]:
    """GET `url` safely with a hard wall-clock limit. Returns (final_url, text).

    The fetch runs in a worker thread: a live test showed one slow site holding a request for
    60 s although every inner timeout was 8 s (closing or draining a slow connection can block).
    The caller now gets an answer within TOTAL_TIMEOUT_SECONDS + 2 whatever the site does; the
    worker finishes or dies on its own.
    """
    pool = ThreadPoolExecutor(max_workers=1)
    future = pool.submit(_fetch_text, url, client)
    try:
        return future.result(timeout=TOTAL_TIMEOUT_SECONDS + 2.0)
    except FutureTimeout as exc:
        raise UnsafeLinkError("That website took too long to answer.") from exc
    finally:
        pool.shutdown(wait=False)


def _fetch_text(url: str, client: httpx.Client | None = None) -> tuple[str, str]:
    deadline = time.monotonic() + TOTAL_TIMEOUT_SECONDS
    own = client is None
    http = client or httpx.Client(follow_redirects=False, headers={"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9"})
    try:
        current = assert_public_url(url)
        for _ in range(MAX_REDIRECTS + 1):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise UnsafeLinkError("That website took too long to answer.")
            try:
                with http.stream("GET", current, timeout=min(remaining, TOTAL_TIMEOUT_SECONDS)) as resp:
                    if resp.status_code in {301, 302, 303, 307, 308}:
                        location = resp.headers.get("location")
                        if not location:
                            raise UnsafeLinkError("That website sent a broken redirect.")
                        current = assert_public_url(urljoin(current, location))
                        continue
                    if resp.status_code in {401, 403, 429}:
                        raise UnsafeLinkError("That website does not allow Rovvy to read it.")
                    if resp.status_code >= 400:
                        raise UnsafeLinkError("That page could not be opened.")
                    ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                    if ctype and not ctype.startswith(ALLOWED_CONTENT_TYPES):
                        raise UnsafeLinkError("That link is not a web page we can read.")
                    declared = resp.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
                        raise UnsafeLinkError("That page is too large to read.")
                    chunks: list[bytes] = []
                    size = 0
                    for chunk in resp.iter_bytes():
                        size += len(chunk)
                        if size > MAX_BYTES:
                            raise UnsafeLinkError("That page is too large to read.")
                        if time.monotonic() > deadline:
                            raise UnsafeLinkError("That website took too long to answer.")
                        chunks.append(chunk)
                    encoding = resp.encoding or "utf-8"
                    return current, b"".join(chunks).decode(encoding, errors="replace")
            except httpx.HTTPError as exc:
                raise UnsafeLinkError("That page could not be opened.") from exc
        raise UnsafeLinkError("That link redirects too many times.")
    finally:
        if own:
            http.close()
