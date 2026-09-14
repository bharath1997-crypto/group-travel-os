"""Amadeus OAuth client-credentials token cache."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass

import httpx

from config import settings

logger = logging.getLogger(__name__)

_TOKEN_REFRESH_BUFFER_SECONDS = 30


@dataclass
class _CachedToken:
    access_token: str
    expires_at: float


class AmadeusOAuthError(Exception):
    """Safe OAuth failure without exposing secrets."""


class AmadeusOAuthClient:
    """In-memory OAuth token cache with refresh-before-expiry."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._token: _CachedToken | None = None

    @staticmethod
    def resolve_base_url() -> str:
        environment = (settings.amadeus_environment or "test").strip().lower()
        if environment == "production":
            return "https://api.amadeus.com"
        return (settings.amadeus_base_url or "https://test.api.amadeus.com").strip()

    @staticmethod
    def resolve_environment() -> str:
        environment = (settings.amadeus_environment or "test").strip().lower()
        if environment not in {"test", "production"}:
            raise AmadeusOAuthError("Amadeus environment must be test or production")
        return environment

    def is_configured(self) -> bool:
        return bool((settings.amadeus_client_id or "").strip()) and bool(
            (settings.amadeus_client_secret or "").strip()
        )

    def _fetch_token(self, *, client: httpx.Client) -> _CachedToken:
        client_id = (settings.amadeus_client_id or "").strip()
        client_secret = (settings.amadeus_client_secret or "").strip()
        if not client_id or not client_secret:
            raise AmadeusOAuthError("Amadeus credentials are not configured")

        base_url = self.resolve_base_url()
        timeout = float(settings.amadeus_timeout_seconds or 15)
        try:
            response = client.post(
                f"{base_url}/v1/security/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=timeout,
            )
        except httpx.TimeoutException as exc:
            raise AmadeusOAuthError("Amadeus authentication timed out") from exc
        except httpx.HTTPError as exc:
            raise AmadeusOAuthError("Amadeus authentication request failed") from exc

        if response.status_code in {401, 403}:
            raise AmadeusOAuthError("Amadeus authentication failed")
        if response.status_code == 429:
            raise AmadeusOAuthError("Amadeus authentication rate limited")
        if response.status_code >= 500:
            raise AmadeusOAuthError("Amadeus authentication temporarily unavailable")
        if response.status_code >= 400:
            raise AmadeusOAuthError("Amadeus authentication rejected the request")

        try:
            payload = response.json()
        except ValueError as exc:
            raise AmadeusOAuthError("Amadeus authentication returned invalid JSON") from exc

        access_token = str(payload.get("access_token") or "").strip()
        expires_in = int(payload.get("expires_in") or 0)
        if not access_token or expires_in <= 0:
            raise AmadeusOAuthError("Amadeus authentication returned an invalid token")

        expires_at = time.time() + max(expires_in - _TOKEN_REFRESH_BUFFER_SECONDS, 1)
        return _CachedToken(access_token=access_token, expires_at=expires_at)

    def get_access_token(self, *, client: httpx.Client | None = None) -> str:
        with self._lock:
            now = time.time()
            if self._token is not None and self._token.expires_at > now:
                return self._token.access_token

            owns_client = client is None
            active_client = client or httpx.Client()
            try:
                self._token = self._fetch_token(client=active_client)
            finally:
                if owns_client:
                    active_client.close()
            return self._token.access_token

    def invalidate(self) -> None:
        with self._lock:
            self._token = None


_oauth_client = AmadeusOAuthClient()


def get_amadeus_oauth_client() -> AmadeusOAuthClient:
    return _oauth_client
