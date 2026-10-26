"""In-memory per-IP rate limit for public Explore directory routes (no extra deps)."""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from app.utils.exceptions import AppException

_WINDOW_SECONDS = 60.0
_MAX_REQUESTS_PER_WINDOW = 120

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def clear_directory_rate_limit_for_tests() -> None:
    with _lock:
        _hits.clear()


def check_directory_rate_limit(client_ip: str | None) -> None:
    ip = (client_ip or "").strip() or "unknown"
    now = time.monotonic()
    with _lock:
        bucket = _hits[ip]
        while bucket and now - bucket[0] > _WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= _MAX_REQUESTS_PER_WINDOW:
            AppException.rate_limit("Too many directory requests. Try again later.")
        bucket.append(now)
