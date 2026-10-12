"""Ticketmaster venue images → place_media (hot-link, priority rules)."""
from __future__ import annotations

import pytest
from sqlalchemy import text

from scaper.connectors.ticketmaster import TicketmasterConnector, venue_image_from_embedded
from scaper.venue_place_media import ticketmaster_venue_caption, upsert_ticketmaster_venue_media
from tests.scaper_fixtures import ticketmaster_event

pytest_plugins = ("tests.test_scaper_postgres",)


def test_venue_image_from_embedded_prefers_venue_not_event() -> None:
    payload = ticketmaster_event()
    url = venue_image_from_embedded(payload, "tmVenue0001")
    assert url == "https://s1.ticketm.net/venue-wide.jpg"


def test_ticketmaster_extract_sets_venue_image_url() -> None:
    from scaper.http import RetryingClient
    import httpx

    client = RetryingClient(httpx.Client(), sleep=lambda _: None)
    tm = TicketmasterConnector(api_key="k", client=client)
    record = tm.extract(ticketmaster_event())
    assert record.venue is not None
    assert record.venue.image_url == "https://s1.ticketm.net/venue-wide.jpg"


def test_ticketmaster_caption_is_stable_per_venue() -> None:
    assert ticketmaster_venue_caption("abc") == "ticketmaster:venue:abc"


@pytest.mark.scaper_postgres
def test_upsert_skips_when_wikimedia_present(pg) -> None:
    _store, conn = pg
    gers_id = "11111111-1111-1111-1111-111111111111"
    conn.execute(
        text(
            """
            INSERT INTO places (id, name, geog, gers_id, city_slug, depth_tier)
            VALUES (
              gen_random_uuid(),
              'Test Place',
              ST_SetSRID(ST_MakePoint(-87.6, 41.8), 4326)::geography,
              CAST(:gers AS uuid),
              'chicago',
              0
            )
            """
        ),
        {"gers": gers_id},
    )
    conn.execute(
        text(
            """
            INSERT INTO place_media (
              id, place_key, thumbnail_url, storage_url, caption, tags, source,
              attribution, license, moderation_status, created_at
            ) VALUES (
              gen_random_uuid(), :pk, 'https://commons.example/x.jpg', 'https://commons.example/x.jpg',
              'file.jpg', '[]'::jsonb, 'open_license', 'Author', 'CC BY', 'approved', now()
            )
            """
        ),
        {"pk": f"gers:{gers_id}"},
    )
    ok = upsert_ticketmaster_venue_media(
        conn,
        gers_id=gers_id,
        venue_external_id="tmVenueX",
        image_url="https://s1.ticketm.net/x.jpg",
    )
    assert ok is False
