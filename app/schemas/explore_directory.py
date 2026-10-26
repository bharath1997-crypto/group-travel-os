from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DirectorySearchHit(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str
    slug: str
    name: str
    state_code: str | None = None
    state_slug: str = ""
    state_name: str | None = None
    population: int | None = None
    event_count: int = 0


class DirectoryCitySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    state_code: str | None = None
    population: int | None = None
    event_count: int = 0
    lat: float | None = None
    lng: float | None = None


class DirectoryStateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    state_code: str | None = None
    population: int | None = None
    event_count: int = 0


class WikipediaBlurb(BaseModel):
    extract: str
    title: str
    url: str
    license_label: str = "CC BY-SA"
    attribution: str = "Source: Wikipedia, CC BY-SA"


class NearestEventsCity(BaseModel):
    slug: str
    name: str
    state_slug: str
    state_name: str | None = None
    event_count: int
    distance_miles: float | None = None


class DirectoryCityPage(BaseModel):
    slug: str
    name: str
    state_slug: str
    state_name: str
    state_code: str | None = None
    population: int | None = None
    lat: float | None = None
    lng: float | None = None
    event_count: int = 0
    place_count: int = 0
    wikipedia: WikipediaBlurb | None = None
    indexable: bool = False
    nearest_with_events: NearestEventsCity | None = None


class DirectoryStatePage(BaseModel):
    slug: str
    name: str
    state_code: str | None = None
    population: int | None = None
    event_count: int = 0
    wikipedia: WikipediaBlurb | None = None
    indexable: bool = False
    cities: list[DirectoryCitySummary] = Field(default_factory=list)
