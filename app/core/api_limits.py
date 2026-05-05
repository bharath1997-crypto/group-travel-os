"""
Explorer-facing limits: response cache TTL, conservative search budgets, outbound
timeouts, and which upstream sources may run.

``MAX_SEARCHES_PER_USER`` is defined for callers (e.g. future routing middleware)
that can identify the user; the aggregate search endpoint may not pass user id yet.
"""

CACHE_TTL_SECONDS = 3600
MAX_SEARCHES_PER_USER = 20
API_TIMEOUT_SECONDS = 8

SOURCES_ENABLED = {
    "ticketmaster": True,
    "yelp": True,
    "gemini": True,
    "youtube": False,
    "google_places": False,
    "eventbrite": False,
    "serpapi": False,
    "apify": False,
}
