"""Seed Wayra canonical knowledge from data/wayra_knowledge_seed.json.

Usage:
  .venv\\Scripts\\python -m scripts.seed_wayra_knowledge
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.wayra_knowledge_seed_service import seed_wayra_knowledge
from app.utils.database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        stats = seed_wayra_knowledge(db)
        print(
            f"Seeded Wayra knowledge: created={stats['created']} "
            f"updated={stats['updated']} utterances={stats['utterances']}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
