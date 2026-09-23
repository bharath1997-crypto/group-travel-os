# Generic Event Scraper

The generic scraper is a standalone, config-driven module at:

- `/home/runner/work/group-travel-os/group-travel-os/app/services/generic_scraper/scraper.py`

## What it does

- Supports source configs with:
  - `name`
  - `url` template with `{city}` and `{city_slug}`
  - `default_city`
  - optional selector and link-pattern overrides
- Extraction pipeline:
  1. Parse `application/ld+json` schema.org `Event` objects.
  2. Fallback to generic HTML card/link scraping.
- Normalizes fields to:
  - `provider_event_id`
  - `title`
  - `url`
  - `start_datetime`
  - `venue_name`
  - `venue_city`
  - `image_url`
  - `price_min`
  - `price_max`
  - `currency`
  - `category`

## Reliability and politeness

- Respects `robots.txt` (cached checks)
- Rotates user-agents randomly
- Applies per-source delay/rate limiting
- Uses timeout + retry + backoff with `httpx.AsyncClient`
- Calls `ScraperFramework.record_failure(...)` via DB session on scrape failures

## Dedup strategy

- Dedups by normalized URL first, then provider event ID.
- Uses SHA-256 short hash (`[:16]`) fallback ID style.

## Add a new source (config-only)

1. Copy `/home/runner/work/group-travel-os/group-travel-os/app/services/generic_scraper/sources.example.json`.
2. Add a new object in `sources`:
   - define `name`, `url`, `default_city`
   - optionally define `selectors` and `link_pattern`
3. Load with `load_sources_config(...)` and pass each source into `GenericEventScraper.scrape_source(...)`.

No scraper code changes are needed for most new sources.
