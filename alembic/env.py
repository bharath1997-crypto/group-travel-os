"""
alembic/env.py — Alembic migration environment

This file configures how Alembic connects to your database and detects models.

CRITICAL RULES:
1. DATABASE_URL is read from settings — never hardcode it here.
2. Base must be imported AFTER app.models (which imports all model classes).
3. Never edit migration files in alembic/versions/ manually.
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Path setup ────────────────────────────────────────────────────────────────
# Add project root to sys.path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ── Import models BEFORE Base ──────────────────────────────────────────────────
# This import triggers app/models/__init__.py which registers all model classes.
# If a model isn't imported there, Alembic won't see it during autogenerate.
import app.models  # noqa: F401 — side-effect import, registers all models

from app.utils.database import Base  # noqa: E402
from config import settings          # noqa: E402

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config

# Read logging config from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point Alembic at our models' metadata so autogenerate works
target_metadata = Base.metadata

# Override the sqlalchemy.url from alembic.ini with our settings value
# This ensures we always use the same DATABASE_URL as the app
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


# ── Migration runners ─────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """
    Run migrations without a live DB connection (generates SQL script only).
    Useful for reviewing what a migration will do before applying it.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,          # Detect column type changes
        compare_server_default=True, # Detect default value changes
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations against a live database connection.
    This is the normal mode: alembic upgrade head
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # No connection pooling in migration scripts
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
