import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.event_dedup_service \
    import EventDedupService

logger = logging.getLogger(__name__)

NORTH_AMERICA_CODES = {'US', 'CA', 'MX'}

_EXPLORE_CONTENTS_QUERY = """
    SELECT
        id,
        event_id,
        title,
        category,
        image_url,
        venue_name,
        venue_lat AS lat,
        venue_lon AS lng,
        city,
        state AS state_province,
        'US' AS country,
        'US' AS country_code,
        start_date,
        start_time,
        price_min AS min_price,
        price_max AS max_price,
        'USD' AS currency,
        ticket_url AS url,
        FALSE AS is_free,
        source
    FROM explore_contents
    WHERE content_type = 'ticketmaster_event'
      AND source = 'ticketmaster'
      AND start_date >= CURRENT_DATE
    ORDER BY start_date ASC NULLS LAST
"""


async def migrate_ticketmaster_to_unified(
    db: Session,
    north_america_only: bool = True,
    dry_run: bool = False
) -> dict:

    # Verify source table exists
    result = db.execute(text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'explore_contents'
        )
    """))
    if not result.scalar():
        return {
            "error": "explore_contents not found",
            "migrated": 0
        }

    rows = db.execute(text(_EXPLORE_CONTENTS_QUERY)).fetchall()

    migrated = 0
    skipped_duplicates = 0
    skipped_region = 0
    errors = 0

    for row in rows:
        try:
            country_code = 'US'

            if north_america_only:
                if country_code not in \
                        NORTH_AMERICA_CODES:
                    skipped_region += 1
                    continue

            title = row.title or ""
            if not title.strip():
                continue

            start_datetime = (
                datetime.combine(
                    row.start_date,
                    datetime.strptime(
                        row.start_time or '19:00', '%H:%M'
                    ).time()
                )
                if row.start_date else None
            )

            if dry_run:
                migrated += 1
                continue

            event, created = EventDedupService\
                .find_or_create_event(
                    db=db,
                    title=title,
                    city=row.city or "",
                    country_code=country_code,
                    start_datetime=start_datetime,
                    venue_name=row.venue_name,
                    venue_address=None,
                    lat=row.lat,
                    lng=row.lng,
                    category=row.category,
                    image_url=row.image_url,
                    description=None,
                    is_free=bool(row.is_free) if row.is_free else False,
                    min_price=row.min_price,
                    max_price=row.max_price,
                    currency=row.currency or 'USD',
                    timezone=None,
                    state_province=row.state_province,
                    country=row.country
                )

            EventDedupService\
                .add_or_update_provider(
                    db=db,
                    event_id=event.id,
                    provider="ticketmaster",
                    provider_event_id=str(row.event_id),
                    provider_url=row.url or "",
                    min_price=row.min_price,
                    max_price=row.max_price,
                    currency=\
                        row.currency or 'USD',
                    availability="available",
                    price_label=(
                        f"From $"
                        f"{row.min_price:.0f}"
                        if row.min_price
                        else "See site"
                    )
                )

            if created:
                migrated += 1
            else:
                skipped_duplicates += 1

            if (migrated + skipped_duplicates) \
                    % 500 == 0:
                db.commit()
                logger.info(
                    f"Progress: {migrated} "
                    f"migrated, "
                    f"{skipped_duplicates} deduped"
                )

        except Exception as e:
            logger.error(
                f"Error migrating event: {e}"
            )
            errors += 1
            continue

    if not dry_run:
        db.commit()

    return {
        "dry_run": dry_run,
        "total_source_rows": len(rows),
        "migrated_new": migrated,
        "skipped_duplicates": skipped_duplicates,
        "skipped_other_regions": skipped_region,
        "errors": errors
    }
