"""Stream gzip-compressed Ticketmaster feed JSON without buffering the full file."""
from __future__ import annotations

import hashlib
import json
import zlib
from collections.abc import Iterator
from typing import Any


class FeedMd5Mismatch(Exception):
    """Compressed byte MD5 did not match the index checksum."""


class FeedParseError(Exception):
    """Incremental JSON parse failed."""


def stream_gzip_json_events(
    compressed_chunks: Iterator[bytes],
    *,
    expected_md5_hex: str | None = None,
) -> tuple[Iterator[dict[str, Any]], str]:
    """
    Incrementally decompress gzip and yield each object in the top-level ``events`` array.

    Returns (events_iterator, md5_hex_of_compressed_bytes).
    """
    md5 = hashlib.md5()
    decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
    decoder = json.JSONDecoder()
    text_buf = ""
    scan_idx = 0
    in_array = False
    digest_holder: list[str] = []

    def _yield_ready() -> Iterator[dict[str, Any]]:
        nonlocal text_buf, scan_idx, in_array
        while True:
            while scan_idx < len(text_buf) and text_buf[scan_idx].isspace():
                scan_idx += 1
            if not in_array:
                key_pos = text_buf.find('"events"', scan_idx)
                if key_pos < 0:
                    return
                bracket = text_buf.find("[", key_pos)
                if bracket < 0:
                    return
                scan_idx = bracket + 1
                in_array = True
                continue
            while scan_idx < len(text_buf) and text_buf[scan_idx] in " \t\r\n,":
                scan_idx += 1
            if scan_idx < len(text_buf) and text_buf[scan_idx] == "]":
                text_buf = text_buf[scan_idx + 1 :]
                scan_idx = 0
                in_array = False
                return
            if scan_idx >= len(text_buf):
                return
            try:
                obj, end = decoder.raw_decode(text_buf, scan_idx)
            except json.JSONDecodeError:
                return
            scan_idx = end
            if isinstance(obj, dict):
                yield obj

    def _events() -> Iterator[dict[str, Any]]:
        nonlocal text_buf
        for chunk in compressed_chunks:
            md5.update(chunk)
            text_buf += decompressor.decompress(chunk).decode("utf-8")
            yield from _yield_ready()
        text_buf += decompressor.flush().decode("utf-8")
        yield from _yield_ready()
        digest = md5.hexdigest()
        digest_holder.append(digest)
        if expected_md5_hex and digest != expected_md5_hex.lower():
            raise FeedMd5Mismatch(f"expected md5 {expected_md5_hex.lower()}, got {digest}")

    def _digest() -> str:
        if not digest_holder:
            raise RuntimeError("read digest after stream is exhausted")
        return digest_holder[0]

    class _Iter:
        def __iter__(self):
            return _events()

        @property
        def digest(self) -> str:
            return _digest()

    # Return iterator; caller must exhaust stream before checking md5 (raises at end).
    it = _events()
    return it, ""  # digest checked via mismatch raise inside iterator


def collect_with_md5(
    compressed_chunks: Iterator[bytes],
    *,
    expected_md5_hex: str | None = None,
) -> tuple[list[dict[str, Any]], str]:
    """Exhaust stream and return all events plus md5 (for tests and dry-run)."""
    md5 = hashlib.md5()
    decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
    decoder = json.JSONDecoder()
    text_buf = ""
    scan_idx = 0
    in_array = False
    out: list[dict[str, Any]] = []

    for chunk in compressed_chunks:
        md5.update(chunk)
        text_buf += decompressor.decompress(chunk).decode("utf-8")
        scan_idx, in_array, text_buf, batch = _drain_buffer(text_buf, scan_idx, in_array, decoder)
        out.extend(batch)
    text_buf += decompressor.flush().decode("utf-8")
    scan_idx, in_array, text_buf, batch = _drain_buffer(text_buf, scan_idx, in_array, decoder)
    out.extend(batch)
    digest = md5.hexdigest()
    if expected_md5_hex and digest != expected_md5_hex.lower():
        raise FeedMd5Mismatch(f"expected md5 {expected_md5_hex.lower()}, got {digest}")
    return out, digest


def _drain_buffer(
    text_buf: str,
    scan_idx: int,
    in_array: bool,
    decoder: json.JSONDecoder,
) -> tuple[int, bool, str, list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    while True:
        while scan_idx < len(text_buf) and text_buf[scan_idx].isspace():
            scan_idx += 1
        if not in_array:
            key_pos = text_buf.find('"events"', scan_idx)
            if key_pos < 0:
                break
            bracket = text_buf.find("[", key_pos)
            if bracket < 0:
                break
            scan_idx = bracket + 1
            in_array = True
            continue
        while scan_idx < len(text_buf) and text_buf[scan_idx] in " \t\r\n,":
            scan_idx += 1
        if scan_idx < len(text_buf) and text_buf[scan_idx] == "]":
            text_buf = text_buf[scan_idx + 1 :]
            scan_idx = 0
            in_array = False
            break
        if scan_idx >= len(text_buf):
            break
        try:
            obj, end = decoder.raw_decode(text_buf, scan_idx)
        except json.JSONDecodeError:
            break
        scan_idx = end
        if isinstance(obj, dict):
            batch.append(obj)
    if scan_idx > 8192:
        text_buf = text_buf[scan_idx:]
        scan_idx = 0
    return scan_idx, in_array, text_buf, batch


def iter_events_from_bytes(data: bytes, *, chunk: int = 65536) -> list[dict[str, Any]]:
    """Helper for tests: gzip bytes -> event dicts."""

    def chunks() -> Iterator[bytes]:
        for i in range(0, len(data), chunk):
            yield data[i : i + chunk]

    events, _ = collect_with_md5(chunks())
    return events


def iter_feed_events(
    compressed_chunks: Iterator[bytes],
    *,
    expected_md5_hex: str | None = None,
) -> tuple[Iterator[dict[str, Any]], "Md5Finalizer"]:
    """Stream events one-by-one; call Md5Finalizer.verify() after exhaustion."""
    md5 = hashlib.md5()
    decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
    decoder = json.JSONDecoder()
    text_buf = ""
    scan_idx = 0
    in_array = False

    class Md5Finalizer:
        def verify(self) -> str:
            digest = md5.hexdigest()
            if expected_md5_hex and digest != expected_md5_hex.lower():
                raise FeedMd5Mismatch(f"expected md5 {expected_md5_hex.lower()}, got {digest}")
            return digest

    def _gen() -> Iterator[dict[str, Any]]:
        nonlocal text_buf, scan_idx, in_array
        for chunk in compressed_chunks:
            md5.update(chunk)
            text_buf += decompressor.decompress(chunk).decode("utf-8")
            scan_idx, in_array, text_buf, batch = _drain_buffer(text_buf, scan_idx, in_array, decoder)
            yield from batch
        text_buf += decompressor.flush().decode("utf-8")
        scan_idx, in_array, text_buf, batch = _drain_buffer(text_buf, scan_idx, in_array, decoder)
        yield from batch

    return _gen(), Md5Finalizer()
