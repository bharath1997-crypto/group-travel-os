"""
app/services/external/base_provider.py — Abstract interface for Explore providers.
"""
from __future__ import annotations

import abc
from typing import Any


class BaseExploreProvider(abc.ABC):
    """
    Abstract base class for all external event providers (DataForSEO, Ticketmaster, etc.)
    """

    @abc.abstractmethod
    def fetch_events(self, city: str, category: str | None = None) -> list[dict[str, Any]]:
        """
        Fetch events from the external provider.
        Should return a raw list of dictionaries as provided by the external API.
        """
        pass

    @property
    @abc.abstractmethod
    def source_name(self) -> str:
        """
        Return the string identifier for this provider (e.g., 'dataforseo').
        """
        pass
