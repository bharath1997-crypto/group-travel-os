from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


def test_migration_numeric_prefixes_are_unique() -> None:
    pattern = re.compile(r"^(\d{3})_.+\.sql$")
    seen: dict[str, list[str]] = {}
    for path in sorted(MIGRATIONS.glob("*.sql")):
        match = pattern.match(path.name)
        assert match, f"migration name must start with NNN_: {path.name}"
        prefix = match.group(1)
        seen.setdefault(prefix, []).append(path.name)
    duplicates = {k: v for k, v in seen.items() if len(v) > 1}
    assert not duplicates, f"duplicate migration numbers: {duplicates}"
