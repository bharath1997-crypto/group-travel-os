"""Connector registry. Add new connectors here."""
from __future__ import annotations

from scaper.config import ScaperSettings
from scaper.connectors.base import Connector
from scaper.connectors.eventbrite import EventbriteConnector
from scaper.connectors.ticketmaster import TicketmasterConnector

CONNECTOR_NAMES = ("eventbrite", "ticketmaster")


def build_connector(name: str, settings: ScaperSettings) -> Connector:
    if name == "eventbrite":
        return EventbriteConnector(token=settings.eventbrite_token)
    if name == "ticketmaster":
        return TicketmasterConnector(api_key=settings.ticketmaster_api_key)
    raise KeyError(f"unknown connector: {name}")
