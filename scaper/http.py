"""HTTP client with bounded retries for provider APIs."""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


class ConnectorError(Exception):
    """Fetch failed in a way retries will not fix (auth, bad config, exhausted retries)."""


class RetryingClient:
    def __init__(
        self,
        client: httpx.Client,
        *,
        max_attempts: int = 4,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._max_attempts = max_attempts
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._sleep = sleep

    def get_json(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        last_error = ""
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._client.get(url, params=params)
            except httpx.TransportError as exc:
                last_error = f"transport error: {exc.__class__.__name__}"
                delay = self._backoff(attempt)
            else:
                if response.status_code == 200:
                    body = response.json()
                    if not isinstance(body, dict):
                        raise ConnectorError(f"GET {url}: expected JSON object")
                    return body
                if response.status_code not in RETRYABLE_STATUS:
                    raise ConnectorError(
                        f"GET {url}: HTTP {response.status_code} {response.text[:200]}"
                    )
                last_error = f"HTTP {response.status_code}"
                delay = self._retry_after(response) or self._backoff(attempt)
            if attempt < self._max_attempts:
                logger.warning("GET %s failed (%s); retry %d in %.1fs", url, last_error, attempt, delay)
                self._sleep(delay)
        raise ConnectorError(f"GET {url}: gave up after {self._max_attempts} attempts ({last_error})")

    def _backoff(self, attempt: int) -> float:
        return min(self._base_delay * 2 ** (attempt - 1), self._max_delay)

    def _retry_after(self, response: httpx.Response) -> float | None:
        header = response.headers.get("Retry-After")
        if header is None:
            return None
        try:
            return min(max(float(header), 0.0), self._max_delay)
        except ValueError:
            return None
