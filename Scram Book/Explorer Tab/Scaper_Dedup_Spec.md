# Scaper — cross-provider dedup spec (APPROVED; implemented as migration 009)

Date: 2026-09-26. Gate: **no second city (Chicago or any other) until this spec is approved and implemented.**
Parent: `Scaper_Connector_Architecture.md`.

## 1. Evidence from Orlando (live Supabase, 141 events: Eventbrite 33, Ticketmaster 108)

| Finding | Count | Example |
|---|---|---|
| Cross-provider duplicate events | 0 | The Eventbrite source is one nightclub organizer, which isn't sold on Ticketmaster. Overlap will appear with more sources. |
| Same-provider duplicate event | 1 | `Joey Cash "Poser Tour"` and `Joey Cash in Orlando`: Ticketmaster/TicketWeb, same venue, same start, two IDs |
| Same place and start ±30 min, **different** shows | 1 | `OMRI. @ CELINE ORLANDO` and `MashBit @ CELINE ORLANDO ROOFTOP` (main room vs rooftop) |
| Venue match missed (exact name, just outside 100 m) | 1 | `Conduit`: Overture row 102 m away |
| Venue match missed (radius) | 1 | `The Abbey`: Overture row 188 m away |
| One venue created as two places | 1 | `The Abbey` and `The Abbey-Orlando` (two Ticketmaster venue IDs) |

**Calibration:** raw trigram `similarity(title)` gave the true duplicate **0.31** and the false pair **0.43**. That's backwards, so a raw title-similarity threshold cannot work. Titles must be normalized first.

## 2. Principles

1. **Never delete to dedup.** Each provider keeps its own `public.events` row. Provenance, purge, expiry and the `(provider, external_id)` upsert key are unchanged.
2. **Hide, don't merge.** Duplicates point at a canonical row; the reader shows canonicals only.
3. **Self-healing.** If a canonical row is purged or deleted, its duplicates reappear automatically (`ON DELETE SET NULL`), and the next dedup pass re-elects a canonical.
4. **When unsure, keep both.** A duplicate card is a small annoyance; hiding a real, different event is a correctness bug.

## 3. Layer A: venue dedup (fixes place fragmentation)

Change `resolve_place` matching from one rule to tiered rules, evaluated in order:

| Tier | Distance | Name rule | Method |
|---|---|---|---|
| A1 | ≤ 100 m | `similarity(norm(name))` ≥ 0.45 (current rule) | `geo_name` |
| A2 | ≤ 250 m | `norm(a) = norm(b)`, or one normalized name contains the other as whole words | `geo_name_wide` |
| A3 | ≤ 500 m | normalized name **equal** + normalized street (`South→S`, `Drive→Dr`, unit/suite dropped) **equal** + postcode (ZIP5) **equal** | `geo_address` |
| — | no match | create a place (current behavior) | `created` |

`norm(name)`: lowercase, then strip punctuation, a leading "the", the source `city_slug` tokens (for example "orlando"), and suffixes such as `- <city>`. So "The Abbey-Orlando" → "abbey" and "The Abbey" → "abbey".

A2 would have fixed Conduit, The Abbey, and the duplicate place for The Abbey-Orlando. It must also keep Hard Rock **Live** and Hard Rock **Cafe** (82 m apart) as separate places. After normalization those names are neither equal nor contained, so A2 leaves them apart.

Backfill: re-run matching for existing `created` links. When one now resolves to a real Overture place, re-point `place_links` and `events.venue_place_id`, then delete the orphaned created place only if nothing else references it.

## 4. Layer B: event dedup

**Schema (migration 009):**
- `public.events.duplicate_of uuid REFERENCES public.events(id) ON DELETE SET NULL`
- `ingest.runs.deduped integer NOT NULL DEFAULT 0`

**Candidate pair:** two non-cancelled events, from any providers (including the same one), where:
- they share the same `venue_place_id`, **or** their `geom` points are ≤ 150 m apart; and
- `|start_a − start_b| ≤ 30 min`.

**Title rule, applied to candidates:** `tnorm(title)` lowercases, then strips punctuation, the venue name, city tokens, and filler (`presents`, `live`, `in`, `at`, `tour`, `tickets`, `@ …` tails). Two events are **duplicates** if either condition holds:
- `word_similarity(shorter, longer)` ≥ 0.8 (headliner containment: "joey cash" vs "joey cash poser"), or
- `similarity(tnorm_a, tnorm_b)` ≥ 0.6.

Otherwise the events are distinct. With Orlando data: Joey Cash → "joey cash poser" vs "joey cash" → duplicate. OMRI → "omri" vs "mashbit rooftop" → distinct.

**Canonical election** (deterministic, recomputed each pass):
1. Prefer the row with an official ticket URL: Ticketmaster first, then Eventbrite.
2. Then prefer more complete data: has a price range, then an image, then an end time.
3. Then the earliest `first_seen_at`, then the lowest `id`.

**Status conflicts:** if any member of a cluster is `cancelled` and others are `scheduled`, the cluster **is not deduped**. Every row shows with its own status. We don't guess which provider is right.

**Where it runs:** in the pipeline after upserts and before purge, scoped to events this run inserted or updated plus their candidates. It's a single SQL pass: `Store.dedupe_events(run)`, with the count logged in `runs.deduped`. It's idempotent.

**Reader:** `/api/v2/explorer/events` adds `AND duplicate_of IS NULL`.

## 5. Tests / acceptance before any second city

- Unit tests for `norm` and `tnorm`, covering every example in §1.
- Rolled-back Postgres suite:
  - Joey Cash pair → one visible row.
  - OMRI/MashBit → both visible.
  - Hard Rock Live/Cafe → two places.
  - Purging a canonical row → its duplicate reappears.
  - A cancelled/scheduled conflict → both visible.
- Live Orlando rerun:
  - Visible count drops by exactly 1 (Joey Cash).
  - `created` places drop from 13 to ≤ 10 (Conduit, The Abbey ×2 resolved).
  - Eventbrite rows unchanged.
- Record the results in the Explorer README. Chicago stays blocked until this is done.

## 6. Open questions for approval

1. Canonical preference: Ticketmaster before Eventbrite (primary seller), or better data first regardless of provider?
2. Cancelled/scheduled conflict: show both (proposed), or trust the cancellation and hide the whole cluster?
3. The 30-min start window and 150 m fallback distance are chosen from one city's data. Accept for Chicago and re-tune after its first run?
4. Separately noted: `/api/v2/explorer/events` caps `limit` at 100. Orlando already has 141 events within 15 km, so the reader needs paging or a ranking order before a denser city.

## 7. Implementation record (2026-09-26)

- Approved decisions: completeness decides the winner and Ticketmaster wins ties. Cancelled and scheduled rows show independently (cancelled rows never cluster). The API filters on `duplicate_of IS NULL` only. The 100-row API cap is a separate task.
- A3 was added after the first gate run. Ticketmaster has 3 venue IDs for The Abbey (100 S Eola Dr, 32801), with pins up to 315 m from Overture's row.
- Orlando gate passed:
  - Visible 140 → 139: only `Joey Cash in Orlando` is hidden.
  - Created places 13 → 10: Conduit and The Abbey via `geo_name_wide`; The Abbey-Orlando via `geo_address`.
  - 0 orphan places.
