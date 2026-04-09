"""
config.py — Application configuration

Single source of truth for all settings.
Reads from .env file automatically via Pydantic Settings.
Import settings anywhere: from config import settings
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "Group Travel OS"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440   # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Firebase (Phase 2) ────────────────────────────────────────────────────
    firebase_credentials_path: str | None = Field(
        default=None,
        validation_alias="FIREBASE_CREDENTIALS_PATH",
    )
    firebase_database_url: str | None = Field(
        default=None,
        validation_alias="FIREBASE_DATABASE_URL",
    )

    # ── OpenWeatherMap (Phase 3) ────────────────────────────────────────────────
    openweather_api_key: str | None = Field(
        default=None,
        validation_alias="OPENWEATHER_API_KEY",
    )

    # ── Stripe (Phase 3) ───────────────────────────────────────────────────────
    stripe_secret_key: str | None = Field(
        default=None,
        validation_alias="STRIPE_SECRET_KEY",
    )
    stripe_webhook_secret: str | None = Field(
        default=None,
        validation_alias="STRIPE_WEBHOOK_SECRET",
    )
    stripe_pro_price_id: str | None = Field(
        default=None,
        validation_alias="STRIPE_PRO_PRICE_ID",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── OAuth (Google / Facebook) ─────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"
    API_PUBLIC_URL: str = Field(
        default="http://localhost:8000",
        validation_alias="API_PUBLIC_URL",
        description="Public base URL for OAuth redirect_uri (must match provider console).",
    )
    GOOGLE_CLIENT_ID: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str | None = Field(
        default=None, validation_alias="GOOGLE_CLIENT_SECRET"
    )
    FACEBOOK_APP_ID: str | None = Field(default=None, validation_alias="FACEBOOK_APP_ID")
    FACEBOOK_APP_SECRET: str | None = Field(
        default=None, validation_alias="FACEBOOK_APP_SECRET"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    lru_cache ensures .env is read once per process — not on every import.
    Override in tests by clearing the cache: get_settings.cache_clear()
    """
    return Settings()


# Module-level singleton — import this everywhere
settings = get_settings()
