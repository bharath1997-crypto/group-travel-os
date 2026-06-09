import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.event_dedup_service \
    import EventDedupService

logger = logging.getLogger(__name__)

NORTH_AMERICA_CODES = {'US', 'CA', 'MX'}


def _pick_column(columns: set[str], *names: str, default: str) -> str:
    for name in names:
        if name in columns:
            return name
    return default


def _build_explore_events_query(db: Session) -> str:
    """Build SELECT compatible with legacy and extended explore_events schemas."""
    column_rows = db.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'explore_events'
    """)).fetchall()
    columns = {row[0] for row in column_rows}

    name_expr = _pick_column(columns, "name", default="title")
    venue_address_expr = _pick_column(columns, "venue_address", default="NULL")
    state_expr = _pick_column(columns, "state_province", "state", default="NULL")
    country_expr = _pick_column(columns, "country", default="NULL")
    country_code_expr = _pick_column(columns, "country_code", default="'US'")
    lat_expr = _pick_column(columns, "lat", "venue_lat", default="NULL")
    lng_expr = _pick_column(columns, "lng", "venue_lon", default="NULL")
    start_expr = _pick_column(columns, "start_datetime", "start_time", default="NULL")
    end_expr = _pick_column(columns, "end_datetime", "end_time", default="NULL")
    timezone_expr = _pick_column(columns, "timezone", default="NULL")
    min_price_expr = _pick_column(columns, "min_price", "price_from", "price_min", default="NULL")
    max_price_expr = _pick_column(columns, "max_price", "price_max", default="NULL")
    currency_expr = _pick_column(columns, "currency", default="'USD'")
    url_expr = _pick_column(columns, "url", "booking_url", "ticket_url", default="NULL")
    status_expr = _pick_column(columns, "status", default="'active'")

    status_filter = (
        f"{status_expr} != 'cancelled'"
        if "status" in columns
        else "TRUE"
    )
    source_filter = (
        "source_name = 'ticketmaster'"
        if "source_name" in columns
        else "TRUE"
    )
    future_filter = (
        f"{start_expr} >= NOW()"
        if start_expr != "NULL"
        else "TRUE"
    )

    return f"""
        SELECT
            id,
            title,
            {name_expr} AS name,
            description,
            category,
            image_url,
            venue_name,
            {venue_address_expr} AS venue_address,
            city,
            {state_expr} AS state_province,
            {country_expr} AS country,
            {country_code_expr} AS country_code,
            {lat_expr} AS lat,
            {lng_expr} AS lng,
            {start_expr} AS start_datetime,
            {end_expr} AS end_datetime,
            {timezone_expr} AS timezone,
            is_free,
            {min_price_expr} AS min_price,
            {max_price_expr} AS max_price,
            {currency_expr} AS currency,
            {url_expr} AS url,
            {status_expr} AS status
        FROM explore_events
        WHERE {status_filter}
          AND {source_filter}
          AND {future_filter}
        ORDER BY {start_expr} ASC NULLS LAST
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
            WHERE table_name = 'explore_events'
        )
    """))
    if not result.scalar():
        return {
            "error": "explore_events not found",
            "migrated": 0
        }

    rows = db.execute(text(_build_explore_events_query(db))).fetchall()

    migrated = 0
    skipped_duplicates = 0
    skipped_region = 0
    errors = 0

    for row in rows:
        try:
            country_code = (
                row.country_code or 'US'
            ).upper()

            if north_america_only:
                if country_code not in \
                        NORTH_AMERICA_CODES:
                    skipped_region += 1
                    continue

            title = row.title or \
                getattr(row, 'name', '') or ""
            if not title.strip():
                continue

            if dry_run:
                migrated += 1
                continue

            event, created = EventDedupService\
                .find_or_create_event(
                    db=db,
                    title=title,
                    city=row.city or "",
                    country_code=country_code,
                    start_datetime=\
                        row.start_datetime,
                    venue_name=row.venue_name,
                    venue_address=\
                        row.venue_address,
                    lat=row.lat,
                    lng=row.lng,
                    category=row.category,
                    image_url=row.image_url,
                    description=row.description,
                    is_free=bool(
                        row.is_free or False
                    ),
                    min_price=row.min_price,
                    max_price=row.max_price,
                    currency=\
                        row.currency or 'USD',
                    timezone=row.timezone,
                    state_province=\
                        row.state_province,
                    country=row.country
                )

            EventDedupService\
                .add_or_update_provider(
                    db=db,
                    event_id=event.id,
                    provider="ticketmaster",
                    provider_event_id=str(row.id),
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
