"""
Travel intel routes — weather, events, places, and combined destination bundle.

GET /api/v1/travel/weather?city=
GET /api/v1/travel/events?city=
GET /api/v1/travel/places?city=
GET /api/v1/travel/intel?city=
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import User
from app.schemas.travel_intel import (
    TravelEventOut,
    TravelIntelOut,
    TravelPlaceOut,
    TravelWeatherOut,
)
from app.services.events_service import get_events
from app.services.places_service import get_places
from app.services.weather_service import get_weather
from app.utils.auth import get_current_user

router = APIRouter(prefix="/travel", tags=["travel"])


def _require_city(city: str) -> str:
    stripped = (city or "").strip()
    if not stripped:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="city query parameter is required",
        )
    return stripped


@router.get("/weather", response_model=TravelWeatherOut | None, summary="Current weather for a city")
def travel_weather(
    city: str = Query(..., min_length=1, max_length=120),
    _: User = Depends(get_current_user),
) -> TravelWeatherOut | None:
    city = _require_city(city)
    data = get_weather(city)
    if data is None:
        return None
    return TravelWeatherOut(**data)


@router.get("/events", response_model=list[TravelEventOut], summary="Upcoming events for a city")
def travel_events(
    city: str = Query(..., min_length=1, max_length=120),
    _: User = Depends(get_current_user),
) -> list[TravelEventOut]:
    city = _require_city(city)
    return [TravelEventOut(**row) for row in get_events(city)]


@router.get("/places", response_model=list[TravelPlaceOut], summary="Top places for a city")
def travel_places(
    city: str = Query(..., min_length=1, max_length=120),
    _: User = Depends(get_current_user),
) -> list[TravelPlaceOut]:
    city = _require_city(city)
    return [TravelPlaceOut(**row) for row in get_places(city)]


@router.get("/intel", response_model=TravelIntelOut, summary="Combined destination intel")
async def travel_intel(
    city: str = Query(..., min_length=1, max_length=120),
    _: User = Depends(get_current_user),
) -> TravelIntelOut:
    city = _require_city(city)
    weather_raw, events_raw, places_raw = await asyncio.gather(
        asyncio.to_thread(get_weather, city),
        asyncio.to_thread(get_events, city),
        asyncio.to_thread(get_places, city),
    )

    weather = TravelWeatherOut(**weather_raw) if weather_raw else None
    events = [TravelEventOut(**row) for row in events_raw]
    places = [TravelPlaceOut(**row) for row in places_raw]

    return TravelIntelOut(
        city=city,
        weather=weather,
        events=events,
        places=places,
        generated_at=datetime.now(timezone.utc),
    )
