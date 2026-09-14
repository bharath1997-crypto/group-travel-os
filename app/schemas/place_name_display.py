from pydantic import BaseModel, ConfigDict, Field


class PlaceNameDisplayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=500)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    osm_type: str | None = Field(default=None, max_length=32)
    osm_id: int | None = None
    country: str | None = Field(default=None, max_length=120)


class PlaceNameDisplayResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    display_name: str = Field(alias="displayName")
    original_name: str | None = Field(default=None, alias="originalName")
    source_language_code: str | None = Field(default=None, alias="sourceLanguageCode")
    source_language_label: str | None = Field(default=None, alias="sourceLanguageLabel")
    translated: bool
