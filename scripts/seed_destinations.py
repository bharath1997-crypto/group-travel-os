"""
Seed 50 curated destinations (10 per category) into PostgreSQL.

Usage (from project root):
    python scripts/seed_destinations.py

Requires DATABASE_URL in .env and applied migrations for `destinations`.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

# Project root on sys.path
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from sqlalchemy.orm import Session

from app.models.destination import Destination
from app.utils.database import SessionLocal

# (name, country, best_months 1-based, avg_cost_usd)
_ROWS: dict[str, list[tuple[str, str, list[int], float]]] = {
    "beach": [
        ("Whitsunday Islands", "Australia", [5, 6, 7, 8, 9], 220.0),
        ("Tulum Riviera", "Mexico", [11, 12, 1, 2, 3, 4], 145.0),
        ("Amalfi Coast", "Italy", [5, 6, 9, 10], 280.0),
        ("Langkawi", "Malaysia", [1, 2, 11, 12], 95.0),
        ("Zanzibar North", "Tanzania", [6, 7, 8, 9, 10], 110.0),
        ("Cape Town Beaches", "South Africa", [11, 12, 1, 2, 3], 125.0),
        ("Fernando de Noronha", "Brazil", [8, 9, 10, 11, 12, 1, 2], 190.0),
        ("Palawan El Nido", "Philippines", [1, 2, 3, 11, 12], 75.0),
        ("Crete South Coast", "Greece", [5, 6, 7, 9, 10], 105.0),
        ("Byron Bay", "Australia", [9, 10, 11, 12, 1, 2, 3], 160.0),
    ],
    "city": [
        ("Lisbon Alfama", "Portugal", [4, 5, 6, 9, 10], 135.0),
        ("Montreal Old Port", "Canada", [6, 7, 8, 9], 120.0),
        ("Hoi An Ancient Town", "Vietnam", [2, 3, 4, 10, 11], 55.0),
        ("Valencia City", "Spain", [4, 5, 6, 9, 10], 115.0),
        ("Medellín El Poblado", "Colombia", [1, 2, 11, 12], 70.0),
        ("Porto Historic", "Portugal", [5, 6, 7, 9], 125.0),
        ("Chiang Mai Old City", "Thailand", [11, 12, 1, 2], 45.0),
        ("Copenhagen Nyhavn", "Denmark", [5, 6, 7, 8], 200.0),
        ("Buenos Aires Palermo", "Argentina", [3, 4, 5, 10, 11], 85.0),
        ("Helsinki Design District", "Finland", [6, 7, 8], 175.0),
    ],
    "adventure": [
        ("Queenstown Alpine", "New Zealand", [12, 1, 2, 3, 6, 7, 8], 185.0),
        ("Interlaken Jungfrau", "Switzerland", [6, 7, 8, 9], 260.0),
        ("Moab Red Rock", "United States", [4, 5, 9, 10], 140.0),
        ("Patagonia W Trek Base", "Chile", [11, 12, 1, 2, 3], 175.0),
        ("Nepal Annapurna Gateway", "Nepal", [3, 4, 5, 10, 11], 65.0),
        ("Banff Town", "Canada", [6, 7, 8, 9], 195.0),
        ("Reykjavík Golden Circle", "Iceland", [5, 6, 7, 8, 9], 230.0),
        ("Costa Rica Arenal", "Costa Rica", [1, 2, 3, 4, 12], 125.0),
        ("Lofoten Islands", "Norway", [6, 7, 8, 9], 210.0),
        ("Atlas High Trailheads", "Morocco", [4, 5, 9, 10], 90.0),
    ],
    "culture": [
        ("Kyoto Gion", "Japan", [3, 4, 5, 10, 11], 155.0),
        ("Marrakesh Medina", "Morocco", [3, 4, 10, 11], 75.0),
        ("Florence Centro", "Italy", [4, 5, 6, 9, 10], 195.0),
        ("Cusco Historic", "Peru", [5, 6, 7, 8, 9], 85.0),
        ("Istanbul Sultanahmet", "Turkey", [4, 5, 9, 10], 95.0),
        ("Mexico City Roma", "Mexico", [10, 11, 12, 1, 2, 3], 70.0),
        ("Jaipur Pink City", "India", [10, 11, 12, 1, 2, 3], 55.0),
        ("Vienna Ringstrasse", "Austria", [4, 5, 6, 9], 175.0),
        ("Seville Triana", "Spain", [3, 4, 5, 10, 11], 110.0),
        ("Havana Vieja", "Cuba", [11, 12, 1, 2, 3, 4], 80.0),
    ],
    "nature": [
        ("Banff Lakes Corridor", "Canada", [7, 8, 9], 185.0),
        ("Torres del Paine Views", "Chile", [11, 12, 1, 2, 3], 165.0),
        ("Plitvice Lakes", "Croatia", [5, 6, 9, 10], 115.0),
        ("Serengeti North", "Tanzania", [6, 7, 8, 9, 10], 350.0),
        ("Kruger Southern Gate", "South Africa", [5, 6, 7, 8, 9], 275.0),
        ("Sapa Rice Terraces", "Vietnam", [9, 10, 11, 3, 4], 60.0),
        ("Fiordland Milford Road", "New Zealand", [11, 12, 1, 2, 3, 4], 170.0),
        ("Borneo Kinabatangan", "Malaysia", [3, 4, 5, 6, 7, 8, 9], 130.0),
        ("Scottish Highlands Glencoe", "United Kingdom", [5, 6, 7, 8, 9], 145.0),
        ("Białowieża Forest Edge", "Poland", [5, 6, 7, 8, 9], 95.0),
    ],
}


def main() -> None:
    session: Session = SessionLocal()
    try:
        batch: list[Destination] = []
        for category, rows in _ROWS.items():
            for name, country, months, cost in rows:
                batch.append(
                    Destination(
                        name=name,
                        country=country,
                        category=category,
                        trending_score=round(random.uniform(20.0, 95.0), 2),
                        image_url=None,
                        best_months=months,
                        avg_cost_per_day=cost,
                    )
                )
        session.add_all(batch)
        session.commit()
        n = len(batch)
        print(f"Seeded {n} destinations")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
