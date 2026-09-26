"""Connector contract. One subclass per provider."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import Any, ClassVar

from pydantic import BaseModel

from scaper.models import ExtractResult, RawItem


class Connector(ABC):
    """
    fetch()   — pull provider entities for one configured source; no DB access.
    extract() — pure: raw payload -> EventRecord, or Rejected with a reason.

    Keeping extract() pure means stored raw_records can be re-extracted after
    a mapping fix without re-fetching from the provider.
    """

    name: ClassVar[str]
    config_model: ClassVar[type[BaseModel]]

    # fetch() sets True only when it walked the provider's full listing (no page
    # cap hit). The pipeline expires vanished events only after a complete fetch.
    last_fetch_complete: bool = False

    def parse_config(self, config: dict[str, Any]) -> BaseModel:
        return self.config_model.model_validate(config)

    @abstractmethod
    def fetch(self, config: dict[str, Any]) -> Iterator[RawItem]: ...

    @abstractmethod
    def extract(self, payload: dict[str, Any]) -> ExtractResult: ...
