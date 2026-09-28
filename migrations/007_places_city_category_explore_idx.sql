-- Explore hub city + category hot-index lookups (bound ORDER BY / LIMIT)

CREATE INDEX IF NOT EXISTS places_city_category_confidence_idx
  ON places (city_slug, basic_category, confidence DESC NULLS LAST)
  WHERE gers_id IS NOT NULL;
