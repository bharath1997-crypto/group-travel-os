"""Cooperative cancel + single-flight guards for long-running bulk fetch jobs."""
from __future__ import annotations

import threading
import time


class CancellableJob:
    def __init__(self, name: str) -> None:
        self.name = name
        self._cancel = threading.Event()
        self._lock = threading.Lock()
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    def try_start(self) -> bool:
        if not self._lock.acquire(blocking=False):
            return False
        self._cancel.clear()
        self._running = True
        return True

    def finish(self) -> None:
        self._running = False
        self._lock.release()

    def request_cancel(self) -> None:
        self._cancel.set()

    def is_cancelled(self) -> bool:
        return self._cancel.is_set()

    def sleep(self, seconds: float) -> bool:
        """Sleep up to `seconds`. Returns True if cancelled during the wait."""
        if seconds <= 0:
            return self.is_cancelled()

        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if self.is_cancelled():
                return True
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            self._cancel.wait(timeout=min(0.25, remaining))
        return self.is_cancelled()


foursquare_job = CancellableJob("foursquare_fetch")
osm_job = CancellableJob("osm_fetch")
