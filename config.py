"""
config.py — Application configuration

Single source of truth for all settings.
Reads from .env file automatically via Pydantic Settings.
Import settings anywhere: from config import settings
"""
import json
from functools import lru_cache
from typing import Any

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_origins_string(s: str) -> list[str]:
    """ALLOWED_ORIGINS env: JSON array, comma-separated URLs, or one URL (Cloud Run / gcloud-safe)."""
    s = s.strip()
    if not s:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    if s.startswith("["):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
            raise ValueError("ALLOWED_ORIGINS JSON must be an array")
        except json.JSONDecodeError:
            if s.endswith("]"):
                inner = s[1:-1].strip()
                if inner:
                    return [p.strip() for p in inner.split(",") if p.strip()]
            raise ValueError("ALLOWED_ORIGINS is not valid JSON or bracketed URL list") from None
    return [p.strip() for p in s.split(",") if p.strip()]


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

    # ── OpenAI (Travello sidecar assistant — fallback) ────────────────────────
    openai_api_key: str | None = Field(
        default=None,
        validation_alias="OPENAI_API_KEY",
    )

    # ── Gemini (primary Travello AI engine) ───────────────────────────────────
    # https://aistudio.google.com/app/apikey — set GEMINI_API_KEY in .env
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias="GEMINI_API_KEY",
    )

    # ── OpenWeatherMap (Phase 3) ────────────────────────────────────────────────
    openweather_api_key: str | None = Field(
        default=None,
        validation_alias="OPENWEATHER_API_KEY",
    )
    serpapi_key: str | None = Field(
        default=None,
        validation_alias="SERPAPI_KEY",
    )

    # ── Explorer third-party APIs (keys in .env) ─────────────────────────────
    ticketmaster_api_key: str | None = Field(
        default=None,
        validation_alias="TICKETMASTER_API_KEY",
    )
    eventbrite_token: str | None = Field(
        default=None,
        validation_alias="EVENTBRITE_TOKEN",
    )
    yelp_api_key: str | None = Field(
        default=None,
        validation_alias="YELP_API_KEY",
    )
    youtube_api_key: str | None = Field(
        default=None,
        validation_alias="YOUTUBE_API_KEY",
    )
    google_places_api_key: str | None = Field(
        default=None,
        validation_alias="GOOGLE_PLACES_API_KEY",
    )
    apify_token: str | None = Field(
        default=None,
        validation_alias="APIFY_TOKEN",
    )
    apify_explorer_actor_id: str | None = Field(
        default=None,
        validation_alias="APIFY_EXPLORER_ACTOR_ID",
        description="Optional Apify actor id for Explorer enrichment.",
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
    # Stored as str so pydantic-settings does not json.loads before validation (breaks plain URLs).
    allowed_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        validation_alias="ALLOWED_ORIGINS",
    )

    @computed_field
    @property
    def allowed_origins(self) -> list[str]:
        return _parse_origins_string(self.allowed_origins_raw)

    @computed_field
    @property
    def frontend_url(self) -> str:
        """Public web app origin (no trailing slash) — used in email deep links."""
        base = (self.FRONTEND_URL or "").strip()
        return base.rstrip("/") if base else "http://localhost:3000"

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

    # ── Brevo (verification, password reset HTML email) ──────────────────────
    brevo_api_key: str = Field(default="", validation_alias="BREVO_API_KEY")
    from_email: str = Field(
        default="noreply@travello.app",
        validation_alias="FROM_EMAIL",
    )
    from_name: str = Field(
        default="Travello",
        validation_alias="FROM_NAME",
    )

    # ── Twilio (SMS / WhatsApp OTP) ───────────────────────────────────────────
    twilio_account_sid: str | None = Field(
        default=None,
        validation_alias="TWILIO_ACCOUNT_SID",
    )
    twilio_auth_token: str | None = Field(
        default=None,
        validation_alias="TWILIO_AUTH_TOKEN",
    )
    twilio_phone_number: str | None = Field(
        default=None,
        validation_alias="TWILIO_PHONE_NUMBER",
    )

    # ── Email (verification, transactional) ─────────────────────────────────
    SMTP_HOST: str | None = Field(default=None, validation_alias="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, validation_alias="SMTP_PORT")
    SMTP_USER: str | None = Field(default=None, validation_alias="SMTP_USER")
    SMTP_PASSWORD: str | None = Field(default=None, validation_alias="SMTP_PASSWORD")
    SMTP_FROM_EMAIL: str | None = Field(
        default=None,
        validation_alias="SMTP_FROM_EMAIL",
        description="From address for verification and system mail.",
    )
    EMAIL_VERIFICATION_TOKEN_HOURS: int = Field(
        default=48,
        validation_alias="EMAIL_VERIFICATION_TOKEN_HOURS",
    )

    @field_validator(
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "FACEBOOK_APP_ID",
        "FACEBOOK_APP_SECRET",
        mode="before",
    )
    @classmethod
    def _strip_optional_oauth(cls, v: Any) -> Any:
        """Avoid newline/whitespace from Secret Manager or echo breaking token exchange."""
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        # Monorepo .env often includes Next.js NEXT_PUBLIC_* and other keys the API does not model.
        extra="ignore",
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
