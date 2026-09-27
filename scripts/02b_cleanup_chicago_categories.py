#!/usr/bin/env python3
"""
Remove leaky-regex category rows from loaded Chicago places.

Uses the same exact-match keep list as scripts/02_filter.py.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_categories_module():
    spec = importlib.util.spec_from_file_location(
        "places_categories",
        ROOT / "scripts" / "places_categories.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load places_categories.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_db_module():
    spec = importlib.util.spec_from_file_location(
        "places_spine_db",
        ROOT / "scripts" / "places_spine_db.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load places_spine_db.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    cats = _load_categories_module()
    db = _load_db_module()
    keep = list(cats.GOING_OUT_CATEGORIES)

    conn = db.connect()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT count(*) FROM places WHERE city_slug = %s",
            ("chicago",),
        )
        before = int(cur.fetchone()[0])

        cur.execute(
            """
            DELETE FROM places
            WHERE city_slug = %s
              AND basic_category <> ALL (%s::text[])
            """,
            ("chicago", keep),
        )
        deleted = cur.rowcount
        conn.commit()

        cur.execute(
            "SELECT count(*) FROM places WHERE city_slug = %s",
            ("chicago",),
        )
        after = int(cur.fetchone()[0])

        print("city_slug=chicago")
        print(f"rows_before={before}")
        print(f"rows_deleted={deleted}")
        print(f"rows_after={after}")
        print("cleanup=ok")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
