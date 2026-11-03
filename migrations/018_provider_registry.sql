-- Provider compliance registry (Scaper bulk-feed spec §5).
-- Additive and idempotent — safe to run twice.

CREATE TABLE IF NOT EXISTS ingest.provider_registry (
  provider            text PRIMARY KEY,
  display_name        text NOT NULL,
  enabled             boolean NOT NULL DEFAULT false,
  commercial_use      text NOT NULL CHECK (commercial_use IN ('allowed', 'conditional', 'not_allowed', 'unknown')),
  storage_rule        text NOT NULL,
  retention_after_end interval,
  attribution_text    text,
  link_required       boolean NOT NULL DEFAULT false,
  terms_url           text,
  terms_checked_on    date,
  account_owner       text NOT NULL DEFAULT 'owner (personal)',
  notes               text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ingest.provider_registry (
  provider, display_name, enabled, commercial_use, storage_rule, retention_after_end,
  attribution_text, link_required, terms_url, terms_checked_on, account_owner, notes
) VALUES
  (
    'ticketmaster', 'Ticketmaster Discovery', true, 'conditional',
    'Store until event end (+6 h when no end time); owner removal within 24 h',
    interval '0',
    'Tickets via Ticketmaster', true,
    'https://www.ticketmaster.com/help/terms.html', DATE '2026-10-05',
    'owner (personal)',
    'Revenue requires written approval; hot-link images; keep event URLs unchanged'
  ),
  (
    'ticketmaster_feed', 'Ticketmaster Discovery Feed', false, 'conditional',
    'Same as ticketmaster; one daily file per country',
    interval '0',
    'Tickets via Ticketmaster', true,
    'https://www.ticketmaster.com/help/terms.html', DATE '2026-10-05',
    'owner (personal)',
    'Bulk feed source disabled until owner enables ticketmaster:feed:* row'
  ),
  (
    'eventbrite', 'Eventbrite', true, 'conditional',
    'Future events only; delete after event occurs',
    interval '0',
    'View on Eventbrite', true,
    'https://www.eventbrite.com/help/en-us/articles/833731/', DATE '2026-10-05',
    'owner (personal)', 'Crawlable event link required; no logo'
  ),
  (
    'overture', 'Overture Maps', true, 'allowed',
    'CDLA Permissive 2.0; attribute Overture',
    NULL, '© OpenStreetMap contributors · Overture Maps Foundation', false,
    'https://overturemaps.org/', NULL, 'owner (personal)', NULL
  ),
  (
    'wikimedia_commons', 'Wikimedia Commons', true, 'allowed',
    'Per-file license; author + license credit',
    NULL, NULL, false, 'https://commons.wikimedia.org/', NULL, 'owner (personal)', NULL
  ),
  (
    'user_upload', 'Rovvy community upload', true, 'allowed',
    'Moderated uploads; EXIF stripped',
    NULL, 'Rovvy community photo', false, NULL, NULL, 'owner (personal)', NULL
  ),
  (
    'yelp', 'Yelp', false, 'not_allowed', 'Not used — paid API, 24h cache limit', NULL, NULL, false, NULL, NULL, 'owner (personal)', 'Not approved'
  ),
  (
    'seatgeek', 'SeatGeek', false, 'not_allowed', 'Not used — no systematic storage', NULL, NULL, false, NULL, NULL, 'owner (personal)', 'Not approved'
  ),
  (
    'meetup', 'Meetup', false, 'not_allowed', 'Not used', NULL, NULL, false, NULL, NULL, 'owner (personal)', 'Not approved'
  ),
  (
    'bandsintown', 'Bandsintown', false, 'not_allowed', 'Not used', NULL, NULL, false, NULL, NULL, 'owner (personal)', 'Not approved'
  ),
  (
    'instagram', 'Instagram (venue connect)', false, 'conditional', 'Venue-owned posts only when connected', NULL, NULL, false, NULL, NULL, 'owner (personal)', 'Not crawl-based'
  ),
  (
    'google_places', 'Google Places', false, 'not_allowed', 'Not used', NULL, NULL, false, NULL, NULL, 'owner (personal)', 'Not approved'
  )
ON CONFLICT (provider) DO NOTHING;
