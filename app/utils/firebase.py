"""
app/utils/firebase.py — Firebase Admin SDK (Realtime Database)

Singleton app initialization. Reads paths and URLs from get_settings().
"""
from __future__ import annotations

import firebase_admin
from firebase_admin import credentials, db

from config import get_settings

_firebase_app: firebase_admin.App | None = None


def get_firebase_app() -> firebase_admin.App:
    """Initialize (once) and return the default Firebase app."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    settings = get_settings()
    if not settings.firebase_credentials_path:
        raise RuntimeError(
            "Firebase is not configured: set FIREBASE_CREDENTIALS_PATH in the environment.",
        )
    if not settings.firebase_database_url:
        raise RuntimeError(
            "Firebase is not configured: set FIREBASE_DATABASE_URL in the environment.",
        )

    cred = credentials.Certificate(settings.firebase_credentials_path)
    _firebase_app = firebase_admin.initialize_app(
        cred,
        {"databaseURL": settings.firebase_database_url},
    )
    return _firebase_app


def get_rtdb_ref(path: str) -> db.Reference:
    """Return a Realtime Database reference for ``path`` (ensure app is initialized)."""
    get_firebase_app()
    return db.reference(path)


def set_rtdb(path: str, data: dict) -> None:
    get_rtdb_ref(path).set(data)


def update_rtdb(path: str, data: dict) -> None:
    get_rtdb_ref(path).update(data)


def delete_rtdb(path: str) -> None:
    get_rtdb_ref(path).delete()


def push_rtdb(path: str, data: dict) -> None:
    get_rtdb_ref(path).push(data)


def get_rtdb(path: str) -> dict | None:
    value = get_rtdb_ref(path).get()
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    return None


def create_custom_token(uid: str) -> str:
    """Generate a custom Firebase token for a given user UID."""
    get_firebase_app()
    from firebase_admin import auth
    token_bytes = auth.create_custom_token(uid)
    return token_bytes.decode("utf-8") if isinstance(token_bytes, bytes) else token_bytes

