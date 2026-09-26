"""Scaper settings. Reads the same .env as Rovvy; SCAPER_DATABASE_URL overrides DATABASE_URL."""
from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ScaperSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(
        default="",
        validation_alias=AliasChoices("SCAPER_DATABASE_URL", "DATABASE_URL"),
    )
    eventbrite_token: str = Field(default="", validation_alias="EVENTBRITE_TOKEN")
    ticketmaster_api_key: str = Field(default="", validation_alias="TICKETMASTER_API_KEY")
