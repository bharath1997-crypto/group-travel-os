# Explore feed — Phase 1 (honest photo-first feed) — build spec

Status: **approved by owner 2026-10-09; assigned to Cursor.** Source: Perplexity proposal +
owner mockups ("For you · Tonight" grid, place page), reviewed by Claude against AGENTS.md
and existing workbook rows. This is not a new roadmap: every item maps to an existing row.
Owner decision 2026-10-09: no-photo fallback = **real map crop (G12)**; no drawn/stock
category images (keeps G08).

## Hard rule (AGENTS.md §4, F15)

Show only provider-stated or Rovvy-measured facts. The mockups' "Open till 1 AM",
"4 spots left", "from $39/pp", "Avg $28/pp", "Good for 4–10", "Fits 6", "$62/pp combo",
"2 friends interested" are placeholders — render them only when the backing data exists;
otherwise hide the element (never estimate, never default).

## Items

| # | Row | Change | Acceptance |
|---|---|---|---|
| 1 | **G18, F02** | Hub uses the user's real location. Today `/explore/places` and `/explore/events` are called with `CITY_COORDS[city]` (`explore-hub-data.ts` ~L148; Chicago = downtown 41.8781,-87.6298) even when the hero shows another place (verified: hero "Naperville · approximate", request at downtown). Use the hero's resolved coordinate (GPS > chosen neighbourhood > IP approximate > city centre) for places radius + distance labels; keep city scope for Scaper events. | Header area and the coordinate in the network request match; distance labels measured from it. |
| 2 | **F27** | Mixed feed: interleave providers within each day (Ticketmaster, Eventbrite, places) instead of pure start-time order. Eventbrite today: Chicago 0 of the first 24 cards. | Chicago first 24 contains Eventbrite events when any exist that day; order deterministic; tests. |
| 3 | **F31, G12** | Photo-first ranking: top slots (first row / big card) prefer listings with a real image (provider image, Wikimedia, approved upload). Listings without a photo get a **static map crop at the venue coordinate (zoom ~17, OpenFreeMap)** instead of "Photo unavailable"; label it as a map, not a photo. | No stock/drawn images; every card has either a real photo or a map crop. |
| 4 | **F03** | Quality filter for top slots: demote national chains (configurable list, e.g. Dunkin', Starbucks, Baskin-Robbins, McDonald's, Subway) and categories that aren't nights out (e.g. religious/office/"organization"); prefer the Wikidata label when a place has `wikidata_qid` (fixes misspellings like "Millienum Park"). Demote, don't delete. | Chicago top 12 has no chain; list + rules unit-tested. |
| 5 | **F05** | Source labels smaller (secondary text), but keep every required credit/link: "View on Eventbrite" / "Tickets via Ticketmaster" as real `<a href>`, Wikimedia photo credit, independence note. | Compliance tests (explore-unknown-field-states) still pass. |
| 6 | **F24, F28** | Reason label per card from real data only: "Tonight", "Free" (provider says free), "0.3 mi", "Starts in 1 h", "Similar to a place you saved" (from the user's Collection). No "Popular with groups"/friends labels until Phase 2 data exists. | Each label traceable to a field; unit-tested. |

Keep as-is: the "What are you doing tonight?" box, calendar counts, vibe chips.

## Out of scope (later phases)

- **Phase 2:** log user actions (save, share to group, vote, add to plan, booking click) and
  rank by them; first-visit "pick 3 vibes"; "Popular with groups" from real counts.
- **Phase 3:** place page tabs (Top/Recent Rovvy moments, What's on, Group fit, Nearby, Make
  it a night) fed by users' trip photos and post-trip answers (data-spine.md "did 6 fit?").
- Instagram content: never (Graph API only for accounts that authorize; data-spine.md §4).

## Verification

Vitest for interleave, ranking, labels, chain filter; `npx tsc --noEmit`; backend pytest
(AGENTS.md §7) if backend touched; browser check on `/explore` (Chicago, location set to a
non-downtown neighbourhood): header and results agree, Eventbrite visible, no "Photo
unavailable" text, required links present. Apply AGENTS.md §1 to rows G18, F02, F27, F31,
G12, F03, F05, F24/F28.
