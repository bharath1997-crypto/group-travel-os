"""Connector registry. Add Phase 1 connectors (ticketmaster, meetup, ...) here."""
from __future__ import annotations

from scaper.config import ScaperSettings
from scaper.connectors.base import Connector
from scaper.connectors.eventbrite import EventbriteConnector

CONNECTOR_NAMES = ("eventbrite",)


def build_connector(name: str, settings: ScaperSettings) -> Connector:
    if name == "eventbrite":
        return EventbriteConnector(token=settings.eventbrite_token)
    raise KeyError(f"unknown connector: {name}")
