"""
app/utils/encryption.py — Fernet symmetric encryption for OAuth tokens

Tokens are encrypted before being stored in the database and decrypted on use.
The key is read from INTEGRATION_TOKEN_ENCRYPTION_KEY. If the key is absent
(local dev / CI), an ephemeral key is generated per process — tokens will not
survive a server restart, but the app will not crash.

Key generation (run once, store the output in your env):
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_cipher: Fernet | None = None


def _get_cipher() -> Fernet:
    global _cipher
    if _cipher is not None:
        return _cipher

    from config import settings

    raw = (settings.INTEGRATION_TOKEN_ENCRYPTION_KEY or "").strip()
    if raw:
        try:
            _cipher = Fernet(raw.encode())
            return _cipher
        except Exception:
            logger.warning("INTEGRATION_TOKEN_ENCRYPTION_KEY is invalid; using ephemeral key")

    # Dev/CI fallback: ephemeral key — tokens won't survive restart
    logger.warning(
        "INTEGRATION_TOKEN_ENCRYPTION_KEY not set — using ephemeral Fernet key. "
        "OAuth tokens will be invalidated on every server restart."
    )
    _cipher = Fernet(Fernet.generate_key())
    return _cipher


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token string. Returns URL-safe base64 ciphertext."""
    return _get_cipher().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a token. Raises ValueError on failure."""
    try:
        return _get_cipher().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Token decryption failed — key mismatch or corrupted data") from exc


def encrypt_state(payload: str) -> str:
    """Encrypt an OAuth state payload for CSRF protection."""
    return encrypt_token(payload)


def decrypt_state(token: str) -> str:
    """Decrypt and verify an OAuth state payload."""
    return decrypt_token(token)
