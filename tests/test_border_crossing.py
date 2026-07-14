from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.border_crossing_service import BorderCrossingService


@pytest.mark.asyncio
async def test_detect_crossings_returns_empty_for_same_country():
    coords = [[-87.63, 41.88], [-87.62, 41.89]]
    with patch(
        "app.services.border_crossing_service._country_at_point",
        new_callable=AsyncMock,
        return_value="United States",
    ):
        crossings = await BorderCrossingService.detect_crossings(
            coords,
            "United States",
            "United States",
        )
    assert crossings == []


@pytest.mark.asyncio
async def test_detect_crossings_finds_transition_on_route():
    coords = [
        [-87.63, 41.88],
        [-89.0, 43.0],
        [-96.0, 48.5],
        [-97.0, 49.0],
        [-97.2, 49.2],
    ]

    async def fake_country(lat: float, lng: float) -> str | None:
        if lat < 49.0:
            return "United States"
        return "Canada"

    with patch(
        "app.services.border_crossing_service._country_at_point",
        new_callable=AsyncMock,
        side_effect=fake_country,
    ):
        crossings = await BorderCrossingService.detect_crossings(
            coords,
            "United States",
            "Canada",
        )

    assert len(crossings) == 1
    crossing = crossings[0]
    assert crossing.fromCountry == "United States"
    assert crossing.toCountry == "Canada"
    assert crossing.latitude >= 48.5
    assert "Immigration check" in crossing.label
    assert crossing.highlightGeometry


def test_build_border_notice():
    from app.schemas.live_routing import BorderCrossingOut

    notice = BorderCrossingService.build_border_notice(
        [
            BorderCrossingOut(
                latitude=49.0,
                longitude=-97.0,
                fromCountry="United States",
                toCountry="Canada",
                label="Immigration check — United States → Canada",
            )
        ]
    )
    assert notice
    assert "international border" in notice.lower()
    assert "United States" in notice
    assert "Canada" in notice
