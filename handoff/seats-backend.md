# Seats — backend (authoritative)

India-first intercity seat sharing inside the social graph. Rovvy moves no money.
Read this before writing Seats code — do not re-derive the model from the UI.

## Product boundary

| Is | Is not |
|---|---|
| Driver posts a trip they already make; riders in groups / FoF take seats | Taxi, ride-hail, dispatch |
| Cost-sharing of fuel + tolls only | Marketplace, commission, payments |
| Posted days ahead, one long leg | Urban live pooling |
| v1: `groups` or `fof` visibility | Public / strangers |

## Legal spine (§3)

- `max_per_seat_paise = ceil(cost_total_paise / (seats_offered + 1))` — driver counts as +1.
- Server **always** recomputes on publish/edit. Client-supplied caps ignored.
- `price_per_seat_paise > max_per_seat_paise` → **422** with computed cap in body.
- No toll data → per-km fallback from `fuel_prices.toll_fallback_paise_per_km`, mark `cost_basis.tolls_estimated = true`. Do **not** block.
- All money: **bigint paise**. No floats in DB.

## Schema (§4)

Tables: `vehicles`, `fuel_prices`, `rides`, `ride_stops`, `ride_bookings`, `ride_watches`, `split_entries`, `connection_paths`.

Key constraints:
- `CHECK (seats_taken <= seats_offered)`
- `CHECK (price_per_seat_paise <= max_per_seat_paise)`
- `CHECK (board_seq < alight_seq)`
- `EXCLUDE (ride_id WITH =, rider_id WITH =) WHERE (status IN ('requested','held','confirmed'))`
- GIST on `ride_stops.geog`, `rides.route_geom`
- btree on `rides (status, depart_at)`, `ride_bookings (ride_id, status)`, `(rider_id, status)`

## Matching (§5)

Join `ride_stops` twice as `sa`, `sb`. Require:
- `sa.seq < sb.seq` (direction)
- `ST_DWithin(sa.geog, from, radius)` and same for `to`
- `(seats_offered - seats_taken) >= :seats`
- `status = 'open'`, `depart_at` in day window
- `visible_to(ride, viewer)` inside SQL — never post-filter in Python

Radius: 25 km intercity, 5 km metro.

Return `board_seq`, `alight_seq` per match.

## Trust (§6)

`visible_to(ride, viewer)`:
- driver always sees own ride
- `groups`: shared group membership
- `fof`: accepted friend-of-friend (max 2 hops) via `friend_requests` status=`accepted`

Stranger → absent from search, **404** on detail (not 403).

Return trust path (`via_user_id`, label) for UI — from `connection_paths`, precomputed on graph change.

## Booking (§7)

Single transaction:
1. `SELECT … FROM rides WHERE id = :id FOR UPDATE`
2. `UPDATE rides SET seats_taken = seats_taken + :seats`
3. `INSERT ride_bookings`

`instant` approval → `confirmed`. `manual` → `held`, `expires_at = min(now()+24h, depart_at-2h)`.

Both paths decrement availability immediately.

CHECK violation / oversell → **409**.

Sweeper `release_stale_holds` every minute: expire `held`, decrement `seats_taken`, reopen `full` → `open`.

## Lifecycle (§8)

`seats_taken` changes only on: →held/confirmed (book), →declined/cancelled (release).

`completed` from job after `arrive_est_at`.

## Splits (§9)

On `completed`: one `split_entries` row per booking, `source_type='ride_booking'`, `source_id=booking.id` UNIQUE (idempotent).

## Notifications (§10)

Only: new request → driver; approved/declined → rider; driver cancel → riders; watch match → watcher (on publish, max 1/watch/day).

## API

```
GET    /api/v1/seats/rides
POST   /api/v1/seats/rides
GET    /api/v1/seats/rides/:id
PATCH  /api/v1/seats/rides/:id
POST   /api/v1/seats/rides/:id/cost
POST   /api/v1/seats/rides/:id/bookings
PATCH  /api/v1/seats/bookings/:id
GET    /api/v1/seats/me
POST   /api/v1/seats/watches
DELETE /api/v1/seats/watches/:id
```

Money in responses: `{amount_paise, display}` — never bare formatted strings.
