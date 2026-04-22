"""
Send a one-off "Hello World" test email via Resend (same payload as the official curl).

Usage from repo root (with venv active):
  python scripts/test_resend_hello.py

Requires in .env:
  RESEND_API_KEY — replace the placeholder re_xxxxxxxxx with your real key from
    https://resend.com/api-keys
  TEST_RESEND_TO (or RESEND_TEST_TO) — who receives the test email.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent

# Repo root on path
sys.path.insert(0, str(_REPO_ROOT))

from dotenv import load_dotenv

# Load repo .env explicitly; override=True so values here win over empty/stale shell env.
_env_file = _REPO_ROOT / ".env"
load_dotenv(_env_file, override=True)

import resend  # noqa: E402


def _env_str(name: str) -> str:
    raw = (os.environ.get(name) or "").strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        raw = raw[1:-1].strip()
    return raw

FROM = "onboarding@resend.dev"


def main() -> None:
    api_key = _env_str("RESEND_API_KEY")
    if not api_key or api_key == "re_xxxxxxxxx" or "your_key" in api_key.lower():
        hint = ""
        if not _env_file.is_file():
            hint = f" (no file at {_env_file})"
        print(
            "Set RESEND_API_KEY in .env to your real Resend API key "
            f"(replace the placeholder re_xxxxxxxxx).{hint}",
            file=sys.stderr,
        )
        sys.exit(1)

    to = _env_str("TEST_RESEND_TO") or _env_str("RESEND_TEST_TO")
    if not to:
        print(
            "Add a recipient to .env (use your own inbox), for example:\n"
            "  TEST_RESEND_TO=you@example.com",
            file=sys.stderr,
        )
        sys.exit(1)
    resend.api_key = api_key

    r = resend.Emails.send(
        {
            "from": FROM,
            "to": to,
            "subject": "Hello World",
            "html": "<p>Congrats on sending your <strong>first email</strong>!</p>",
        }
    )
    print("Resend response:", r)


if __name__ == "__main__":
    main()
