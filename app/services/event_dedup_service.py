import hashlib
import re
from datetime import datetime, timezone as dt_timezone
from rapidfuzz import fuzz
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func
import logging

logger = logging.getLogger(__name__)

class EventDedupService:

    STOP_WORDS = {
        'the', 'a', 'an', 'at', 'in', 'on', 'of',
        'presents', 'featuring', 'feat', 'ft',
        'official', 'live', 'concert', 'show',
        'tour', 'event', 'festival',
        '2024', '2025', '2026', '2027'
    }

    @staticmethod
    def normalize_title(title: str) -> str:
        if not title:
            return ""
        t = title.lower().strip()
        t = re.sub(r'[^\w\s]', ' ', t)
        words = [
            w for w in t.split()
            if w not in EventDedupService.STOP_WORDS
        ]
        return re.sub(r'\s+', ' ',
            ' '.join(words)).strip()

    @staticmethod
    def generate_dedup_hash(
        title: str,
        city: str,
        venue_name: str,
        start_datetime: datetime
    ) -> str:
        normalized = EventDedupService\
            .normalize_title(title)
        city_clean = (city or "unknown")\
            .lower().strip()
        venue_clean = (venue_name or "")\
            .lower().strip()[:50]
        date_str = start_datetime\
            .strftime("%Y-%m-%d") \
            if start_datetime else "unknown"
        key = f"{normalized}|{city_clean}" \
              f"|{venue_clean}|{date_str}"
        return hashlib.sha256(
            key.encode()).hexdigest()

    @staticmethod
    def find_or_create_event(
        db: Session,
        title: str,
        city: str,
        country_code: str,
        start_datetime: datetime,
        venue_name: str = None,
        venue_address: str = None,
        lat: float = None,
        lng: float = None,
        category: str = None,
        image_url: str = None,
        description: str = None,
        is_free: bool = False,
        min_price: float = None,
        max_price: float = None,
        currency: str = "USD",
        timezone: str = None,
        state_province: str = None,
        country: str = None
    ) -> tuple:
        from app.models.unified_experience \
            import UnifiedExperience

        dedup_hash = EventDedupService\
            .generate_dedup_hash(
                title,
                city or "",
                venue_name or "",
                start_datetime
            )

        # Fast path: exact hash match
        stmt = select(UnifiedExperience).where(
            UnifiedExperience.dedup_hash == dedup_hash
        )
        existing = db.execute(stmt)\
            .scalar_one_or_none()
        if existing:
            return existing, False

        # Fuzzy match: same city + same date
        if start_datetime and city:
            day_start = start_datetime.replace(
                hour=0, minute=0,
                second=0, microsecond=0
            )
            day_end = start_datetime.replace(
                hour=23, minute=59,
                second=59, microsecond=999999
            )
            stmt2 = select(UnifiedExperience).where(
                and_(
                    func.lower(UnifiedExperience.city)
                        == city.lower().strip(),
                    UnifiedExperience.start_datetime
                        >= day_start,
                    UnifiedExperience.start_datetime
                        <= day_end
                )
            )
            candidates = db.execute(stmt2)\
                .scalars().all()

            norm_new = EventDedupService\
                .normalize_title(title)
            for candidate in candidates:
                norm_existing = EventDedupService\
                    .normalize_title(
                        candidate.title
                    )
                if fuzz.ratio(
                    norm_new, norm_existing
                ) >= 85:
                    return candidate, False

        # Create new event
        now = datetime.now(dt_timezone.utc).replace(tzinfo=None)
        new_event = UnifiedExperience(
            title=title,
            canonical_title=title,
            normalized_title=EventDedupService
                .normalize_title(title),
            city=city,
            state_province=state_province,
            country=country,
            country_code=country_code,
            start_datetime=start_datetime,
            venue_name=venue_name,
            venue_address=venue_address,
            lat=lat,
            lng=lng,
            category=category,
            image_url=image_url,
            description=description,
            is_free=is_free,
            min_price=min_price,
            max_price=max_price,
            currency=currency,
            timezone=timezone,
            dedup_hash=dedup_hash,
            created_at=now,
            updated_at=now,
            last_synced_at=now
        )
        db.add(new_event)
        db.flush()
        return new_event, True

    @staticmethod
    def add_or_update_provider(
        db: Session,
        event_id,
        provider: str,
        provider_event_id: str,
        provider_url: str,
        min_price: float = None,
        max_price: float = None,
        currency: str = "USD",
        availability: str = "available",
        affiliate_url: str = None,
        price_label: str = None,
        raw_data: dict = None
    ):
        from app.models.event_provider \
            import EventProvider

        stmt = select(EventProvider).where(
            and_(
                EventProvider.provider == provider,
                EventProvider.provider_event_id
                    == provider_event_id
            )
        )
        existing = db.execute(stmt)\
            .scalar_one_or_none()
        now = datetime.now(dt_timezone.utc).replace(tzinfo=None)

        if existing:
            existing.min_price = min_price
            existing.max_price = max_price
            existing.availability = availability
            existing.last_updated = now
            if affiliate_url:
                existing.affiliate_url = \
                    affiliate_url
            if price_label:
                existing.price_label = price_label
            return existing

        entry = EventProvider(
            event_id=event_id,
            provider=provider,
            provider_event_id=provider_event_id,
            provider_url=provider_url,
            affiliate_url=affiliate_url,
            min_price=min_price,
            max_price=max_price,
            currency=currency,
            availability=availability,
            price_label=price_label,
            raw_data=raw_data,
            last_updated=now
        )
        db.add(entry)
        return entry
