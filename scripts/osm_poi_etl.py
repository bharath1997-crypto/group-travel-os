"""
Rovvy OSM POI ETL Script
Extracts POIs from OSM PBF files and imports into PostgreSQL explore_contents table.
Usage: python osm_poi_etl.py --pbf illinois-latest.osm.pbf
"""

import osmium
import psycopg2
from psycopg2.extras import Json, execute_values
import os
import sys
import argparse
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# Category mapping — OSM tags → Rovvy categories
CATEGORY_TAGS = {
    'Food': [
        ('amenity', 'restaurant'),
        ('amenity', 'cafe'),
        ('amenity', 'fast_food'),
        ('amenity', 'food_court'),
        ('amenity', 'ice_cream'),
    ],
    'Nightlife': [
        ('amenity', 'bar'),
        ('amenity', 'pub'),
        ('amenity', 'nightclub'),
        ('amenity', 'biergarten'),
    ],
    'Shopping': [
        ('shop', 'mall'),
        ('shop', 'supermarket'),
        ('shop', 'department_store'),
        ('shop', 'clothes'),
        ('shop', 'electronics'),
        ('amenity', 'marketplace'),
    ],
    'Gaming': [
        ('leisure', 'amusement_arcade'),
        ('amenity', 'arcade'),
        ('leisure', 'escape_game'),
    ],
    'Amusement': [
        ('tourism', 'theme_park'),
        ('leisure', 'water_park'),
        ('leisure', 'amusement_park'),
    ],
    'Parks': [
        ('leisure', 'park'),
        ('leisure', 'nature_reserve'),
        ('boundary', 'national_park'),
    ],
    'Trekking': [
        ('natural', 'peak'),
        ('leisure', 'trail'),
        ('highway', 'trailhead'),
    ],
    'Landmarks': [
        ('tourism', 'attraction'),
        ('tourism', 'museum'),
        ('tourism', 'viewpoint'),
        ('historic', 'monument'),
        ('historic', 'memorial'),
        ('amenity', 'theatre'),
        ('amenity', 'cinema'),
    ],
}

# Build reverse lookup: (key, value) -> category
TAG_TO_CATEGORY = {}
for category, tags in CATEGORY_TAGS.items():
    for key, value in tags:
        TAG_TO_CATEGORY[(key, value)] = category

MAX_PER_CATEGORY = 5000  # Max places per category per state

class POIHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.pois = []
        self.counts = {cat: 0 for cat in CATEGORY_TAGS}
        self.skipped = 0

    def process_tags(self, tags, lat, lon):
        # Skip if no name
        name = tags.get('name')
        if not name or len(name.strip()) == 0:
            self.skipped += 1
            return

        # Find category
        category = None
        for key, value in TAG_TO_CATEGORY:
            if tags.get(key) == value:
                category = TAG_TO_CATEGORY[(key, value)]
                break

        if not category:
            return

        # Check max per category
        if self.counts[category] >= MAX_PER_CATEGORY:
            return

        # Get address info
        city = (tags.get('addr:city') or
                tags.get('addr:town') or
                tags.get('addr:village') or '')
        state = tags.get('addr:state', '')
        address = tags.get('addr:street', '')
        if tags.get('addr:housenumber'):
            address = f"{tags.get('addr:housenumber')} {address}".strip()

        self.pois.append({
            'name': name.strip()[:200],
            'category': category,
            'lat': round(lat, 6),
            'lon': round(lon, 6),
            'city': city[:100] or 'Unknown',
            'state': state[:50],
            'address': address[:200],
            'source': 'openstreetmap',
            'tags': dict(tags),
        })
        self.counts[category] += 1

    def node(self, n):
        if n.location.valid():
            self.process_tags(n.tags, n.location.lat, n.location.lon)

    def way(self, w):
        try:
            if w.nodes:
                # Use centroid of first and last node as approximation
                loc = w.nodes[0].location
                if loc.valid():
                    self.process_tags(w.tags, loc.lat, loc.lon)
        except Exception:
            pass


def import_to_db(pois, db_url):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    batch_size = 500
    inserted = 0

    for i in range(0, len(pois), batch_size):
        batch = pois[i:i+batch_size]
        values = []
        for poi in batch:
            event_id = f"osm_{poi['category'].lower()}_{abs(hash(poi['name'] + str(poi['lat']) + str(poi['lon'])))}"
            values.append((
                event_id,
                poi['name'],
                poi['category'],
                'osm_place',
                poi['name'],
                poi['lat'],
                poi['lon'],
                poi['city'] or 'Unknown',
                poi['state'],
                'openstreetmap',
                Json({'country': 'US', 'rating': 0.0}),
                datetime.now(timezone.utc),
            ))

        execute_values(
            cur,
            """
            INSERT INTO explore_contents
            (id, event_id, title, category, content_type,
             venue_name, venue_lat, venue_lon,
             city, state, source, data, fetched_at)
            VALUES %s
            ON CONFLICT (event_id) DO NOTHING
            """,
            values,
            template="(gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        )

        conn.commit()
        inserted += len(batch)
        logger.info(f"Progress: {inserted}/{len(pois)} inserted")

    cur.close()
    conn.close()
    return inserted, 0


def main():
    parser = argparse.ArgumentParser(description='Import OSM POIs into Rovvy DB')
    parser.add_argument('--pbf', required=True, help='Path to .osm.pbf file')
    parser.add_argument('--dry-run', action='store_true', help='Parse only, do not import')
    args = parser.parse_args()

    pbf_path = args.pbf
    if not os.path.exists(pbf_path):
        logger.error(f"PBF file not found: {pbf_path}")
        sys.exit(1)

    db_url = os.environ.get('DATABASE_URL')
    if not db_url and not args.dry_run:
        logger.error("DATABASE_URL not found in .env")
        sys.exit(1)

    logger.info(f"Processing {pbf_path}...")
    handler = POIHandler()
    handler.apply_file(pbf_path, locations=True)

    logger.info(f"\n=== PARSE RESULTS ===")
    logger.info(f"Total POIs found: {len(handler.pois)}")
    logger.info(f"Skipped (no name): {handler.skipped}")
    for cat, count in handler.counts.items():
        logger.info(f"  {cat}: {count}")

    if args.dry_run:
        logger.info("Dry run — skipping DB import")
        return

    logger.info(f"\nImporting {len(handler.pois)} POIs to database...")
    inserted, updated = import_to_db(handler.pois, db_url)
    logger.info(f"\n=== IMPORT COMPLETE ===")
    logger.info(f"Inserted: {inserted}")
    logger.info(f"Updated: {updated}")
    logger.info(f"Total: {inserted + updated}")


if __name__ == '__main__':
    main()
