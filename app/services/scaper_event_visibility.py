"""
Which Scaper events a reader shows — shared by /api/v2/explorer/events and the
v1 Explore hub so both apply identical rules.

Dedup (scaper/dedup.py) points every member of a group (duplicate listings, or a
timed-entry series on one local day) at its canonical row via `duplicate_of`.
Readers show ONE row per group, chosen at read time: the next slot that has not
started yet, else the most recently started one. Picking at read time means a
group never vanishes when its canonical slot expires between Scaper runs.
"""
from __future__ import annotations


def visible_events_cte(extra_where: str = "") -> str:
    """`WITH visible AS (...)` — one row per dedup group. Binds :now; extra_where must start with AND."""
    return f"""
    WITH visible AS (
      SELECT DISTINCT ON (COALESCE(duplicate_of, id)) *
      FROM public.events
      WHERE status IN ('scheduled', 'sold_out', 'postponed')
        AND COALESCE(expires_at, end_time, start_time) > :now
        {extra_where}
      ORDER BY
        COALESCE(duplicate_of, id),
        (start_time < :now),
        CASE WHEN start_time >= :now THEN start_time END ASC NULLS LAST,
        start_time DESC,
        (duplicate_of IS NULL) DESC,
        id
    )
    """
