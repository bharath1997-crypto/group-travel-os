# FL-045 — Travelpayouts white-label embed rollback

**Date:** 2026-08-30  
**Sprint:** 2  
**Status:** Blocked (not complete)

## Context

A direct same-document Travelpayouts white-label script (`https://tpemd.com/wl_web/main.js?wl_id=21482`) was embedded on the Rovvy Flights page via `TravelpayoutsWhiteLabel.tsx`. Third-party global styles leaked into the application shell, breaking desktop header/navigation, typography, spacing, and duplicating the flight-search UI.

## Result

The direct same-document Travelpayouts white-label embed was rolled back because third-party global styles corrupted Rovvy's application shell and duplicated the search UI. Provider-owned embedding remains blocked pending a safely isolated and provider-supported implementation.

## Files changed

- `frontend/app/(dashboard)/flights/page.tsx` — removed `TravelpayoutsWhiteLabel` import and render
- `frontend/components/travel/TravelpayoutsWhiteLabel.tsx` — deleted

## Verification

- Browser QA (localhost:3000/flights, authoritative project `D:\group travel os`):
  - Desktop: horizontal header nav, single `FlightSearchForm`, Provider directory button preserved, no `#tpwl-search` / `#tpwl-tickets`, no overlapping partner UI
  - No mobile bottom nav at desktop width

## Preserved

- Rovvy `FlightSearchForm`, provider directory button, redirect-only language, provider-governance work
- Pre-existing `tpembars.com` Drive script in `frontend/app/layout.tsx` (unchanged)

## Risks / next action

- Do not re-embed Travelpayouts white-label in the main React document
- Future experiments require a dedicated route, iframe, or subdomain only if Travelpayouts officially supports isolation
- Re-open FL-045 when an isolated, provider-supported embedding path is approved
