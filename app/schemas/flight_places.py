"""Airport / city suggestions for flight search autocomplete."""

from pydantic import BaseModel, ConfigDict, Field


class FlightPlaceSuggestion(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    label: str
    detail: str = ""
    iata: str
    place_type: str = Field(description="city | airport | country | metro")
    city: str = ""
    region: str = ""
    country: str = ""
    country_code: str = ""
    distance_km: float | None = None
    group: str = Field(default="", description="Optional UI group label")
    metro_iata: str = Field(default="", description="Metropolitan code when confirmed by provider")


class FlightCountryItem(BaseModel):
    code: str
    name: str
    airport_count: int


class FlightRegionItem(BaseModel):
    code: str
    name: str
    country_code: str
    airport_count: int
    region_code: str = ""
    sample_cities: str = ""
    subtitle: str = ""


class FlightCityItem(BaseModel):
    name: str
    country_code: str
    region_code: str = ""
    region_name: str = ""
    airport_count: int


class FlightNearbyAirportsResponse(BaseModel):
    airports: list[FlightPlaceSuggestion]
    query_lat: float
    query_lng: float
