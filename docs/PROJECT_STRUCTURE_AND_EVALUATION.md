# Rovvy — Project Structure and Evaluation Document

## 1. Executive Summary
Rovvy (formerly Group Travel OS) is a modern, social group travel operating system designed for planning and executing collaborative trips. The application is in a high-fidelity development stage, with a substantial portion of the core modules already implemented. 

The core product areas include:
*   **Explorer & Activity Discovery**: Features to browse nearby experiences, activities, events, and weather to pre-warm plans.
*   **Trip Room / Travel Hub**: Centralized planning dashboards for flights, hotels, routes, and buses.
*   **Live Mode**: A real-time, map-centric view supporting turn-by-turn navigation (solo or group-focused) with place previews, reverse geocoding, and OSRM route generation.
*   **Rovi Travel Route Intelligence**: A hybrid, deterministic data engine paired with Gemini AI that resolves long-distance or international route planning cleanly without hallucinations.
*   **Rovvy Lounge & Communication**: Features supporting real-time chat, group presence, and coordination.
*   **Split Activities & Expenses**: Collaborative budgeting and expense tracking.

---

## 2. Comprehensive Repository Structure & Codebase File Registry

### Root Configuration and Infrastructure
*   `alembic.ini` — Alembic database migration environment settings.
*   `config.py` — Centralized Pydantic Settings implementation.
*   `pyproject.toml` — Pytest, Type Checking (Pyright), and code style settings.
*   `requirements.txt` — Main Python dependency specifications.
*   `run.py` — Backend dev server uvicorn trigger script.

---

### Backend Codebase (`app/`)

#### 1. Core and Initializers
*   `app/main.py` — Main FastAPI initialization and route setup.
*   `app/__init__.py`
*   `app/core/` — Core utility modules.
*   `app/db/` — Database driver hooks.
*   `app/jobs/` — Scraper and async jobs (viator_sync.py, eventbrite_sync.py, osm_etl.py).

#### 2. Models (`app/models/`)
*   `app/models/blocked_user.py`
*   `app/models/buddy_trip.py`
*   `app/models/cart.py`
*   `app/models/currency_rate.py`
*   `app/models/data_export.py`
*   `app/models/data_import.py`
*   `app/models/destination.py`
*   `app/models/emergency_contact.py`
*   `app/models/event_provider.py`
*   `app/models/expense.py`
*   `app/models/explorer_cache.py`
*   `app/models/explore_content.py`
*   `app/models/explore_event.py`
*   `app/models/friend_request.py`
*   `app/models/group.py`
*   `app/models/group_invitation.py`
*   `app/models/group_join_request.py`
*   `app/models/imported_short.py`
*   `app/models/live_session.py`
*   `app/models/location.py`
*   `app/models/location_hashtag.py`
*   `app/models/location_share.py`
*   `app/models/lounge.py`
*   `app/models/meet_point.py`
*   `app/models/notification.py`
*   `app/models/place_registry.py`
*   `app/models/poll.py`
*   `app/models/road_report.py`
*   `app/models/saved_pin.py`
*   `app/models/scraper_health.py`
*   `app/models/sos_event.py`
*   `app/models/spectator_invite.py`
*   `app/models/subscription.py`
*   `app/models/trip.py`
*   `app/models/trip_join_request.py`
*   `app/models/trip_plan.py`
*   `app/models/trip_roster.py`
*   `app/models/trip_track.py`
*   `app/models/unified_experience.py`
*   `app/models/user.py`
*   `app/models/user_app_settings.py`
*   `app/models/user_integration.py`
*   `app/models/wayra.py`
*   `app/models/__init__.py`

#### 3. Routes (`app/routes/`)
*   `app/routes/activities.py`
*   `app/routes/admin.py`
*   `app/routes/admin_events.py`
*   `app/routes/ai_assistant.py`
*   `app/routes/app_settings.py`
*   `app/routes/auth.py`
*   `app/routes/buddy.py`
*   `app/routes/buses.py`
*   `app/routes/cart.py`
*   `app/routes/connect.py`
*   `app/routes/data_export.py`
*   `app/routes/data_import.py`
*   `app/routes/email_verification.py`
*   `app/routes/expenses.py`
*   `app/routes/explore.py`
*   `app/routes/explorer.py`
*   `app/routes/feed.py`
*   `app/routes/flights.py`
*   `app/routes/geocoding.py`
*   `app/routes/groups.py`
*   `app/routes/hotels.py`
*   `app/routes/integrations.py`
*   `app/routes/invitations.py`
*   `app/routes/join_requests.py`
*   `app/routes/live_ai.py`
*   `app/routes/locations.py`
*   `app/routes/lounge.py`
*   `app/routes/meet_points.py`
*   `app/routes/notifications.py`
*   `app/routes/payments.py`
*   `app/routes/pins.py`
*   `app/routes/places.py`
*   `app/routes/place_media.py`
*   `app/routes/polls.py`
*   `app/routes/routes.py`
*   `app/routes/route_intelligence.py`
*   `app/routes/social.py`
*   `app/routes/stats.py`
*   `app/routes/subscriptions.py`
*   `app/routes/timers.py`
*   `app/routes/travel_intel.py`
*   `app/routes/trips.py`
*   `app/routes/trip_space.py`
*   `app/routes/unified_experiences.py`
*   `app/routes/users.py`
*   `app/routes/video_extract.py`
*   `app/routes/weather.py`
*   `app/routes/__init__.py`

#### 4. Schemas (`app/schemas/`)
*   `app/schemas/activity.py`
*   `app/schemas/ai_assistant.py`
*   `app/schemas/app_settings.py`
*   `app/schemas/auth.py`
*   `app/schemas/buddy.py`
*   `app/schemas/bus.py`
*   `app/schemas/cart.py`
*   `app/schemas/connect.py`
*   `app/schemas/data_export.py`
*   `app/schemas/data_import.py`
*   `app/schemas/expense.py`
*   `app/schemas/explore.py`
*   `app/schemas/explorer.py`
*   `app/schemas/explorer_v2.py`
*   `app/schemas/flight.py`
*   `app/schemas/flight_preferences.py`
*   `app/schemas/group.py`
*   `app/schemas/hotel.py`
*   `app/schemas/invitation.py`
*   `app/schemas/live_location_context.py`
*   `app/schemas/location.py`
*   `app/schemas/lounge.py`
*   `app/schemas/meet_point.py`
*   `app/schemas/notification.py`
*   `app/schemas/places.py`
*   `app/schemas/place_media.py`
*   `app/schemas/poll.py`
*   `app/schemas/route.py`
*   `app/schemas/route_intelligence.py`
*   `app/schemas/social.py`
*   `app/schemas/timer.py`
*   `app/schemas/travel_info.py`
*   `app/schemas/travel_intel.py`
*   `app/schemas/trip.py`
*   `app/schemas/trip_item.py`
*   `app/schemas/trip_public.py`
*   `app/schemas/__init__.py`

#### 5. Services (`app/services/`)
*   `app/services/activity_service.py`
*   `app/services/ai_assistant_service.py`
*   `app/services/app_settings_service.py`
*   `app/services/auth_service.py`
*   `app/services/buddy_service.py`
*   `app/services/bus_service.py`
*   `app/services/cart_notification_service.py`
*   `app/services/cart_service.py`
*   `app/services/connect_service.py`
*   `app/services/currency_service.py`
*   `app/services/data_export_service.py`
*   `app/services/data_import_service.py`
*   `app/services/deal_scanner_service.py`
*   `app/services/email_service.py`
*   `app/services/email_verification_service.py`
*   `app/services/events_service.py`
*   `app/services/event_dedup_service.py`
*   `app/services/expense_service.py`
*   `app/services/explorer_normalize.py`
*   `app/services/explorer_service.py`
*   `app/services/explore_city_extended_service.py`
*   `app/services/explore_content_service.py`
*   `app/services/explore_event_normalizer.py`
*   `app/services/explore_service.py`
*   `app/services/feed_service.py`
*   `app/services/flight_service.py`
*   `app/services/geocoding_service.py`
*   `app/services/google_calendar_service.py`
*   `app/services/google_drive_service.py`
*   `app/services/group_service.py`
*   `app/services/hotel_service.py`
*   `app/services/imported_short_service.py`
*   `app/services/invitation_service.py`
*   `app/services/join_request_service.py`
*   `app/services/live_ai_service.py`
*   `app/services/live_location_context_service.py`
*   `app/services/location_service.py`
*   `app/services/lounge_service.py`
*   `app/services/maps_export_service.py`
*   `app/services/meet_point_service.py`
*   `app/services/microsoft_calendar_service.py`
*   `app/services/notification_service.py`
*   `app/services/oauth_service.py`
*   `app/services/otp_service.py`
*   `app/services/pin_service.py`
*   `app/services/places_nearby_service.py`
*   `app/services/places_service.py`
*   `app/services/place_autocomplete_service.py`
*   `app/services/place_enrichment_service.py`
*   `app/services/place_key_service.py`
*   `app/services/place_media_service.py`
*   `app/services/place_wikipedia_service.py`
*   `app/services/poll_service.py`
*   `app/services/presence_service.py`
*   `app/services/route_intelligence_service.py`
*   `app/services/route_service.py`
*   `app/services/rovi_route_ai_service.py`
*   `app/services/scraper_framework.py`
*   `app/services/serpapi_service.py`
*   `app/services/social_service.py`
*   `app/services/stats_service.py`
*   `app/services/stripe_service.py`
*   `app/services/subscription_service.py`
*   `app/services/ticketmaster_migration_service.py`
*   `app/services/timer_service.py`
*   `app/services/travel_info_service.py`
*   `app/services/trip_export_service.py`
*   `app/services/trip_join_request_service.py`
*   `app/services/trip_public_service.py`
*   `app/services/trip_service.py`
*   `app/services/user_flight_preference_service.py`
*   `app/services/wayra_group_service.py`
*   `app/services/wayra_intent.py`
*   `app/services/wayra_personal_service.py`
*   `app/services/wayra_rate_limiter.py`
*   `app/services/wayra_service.py`
*   `app/services/weather_service.py`
*   `app/services/__init__.py`

#### 6. Utilities (`app/utils/`)
*   `app/utils/auth.py`
*   `app/utils/database.py`
*   `app/utils/exceptions.py`
*   `app/utils/feature_gate.py`
*   `app/utils/firebase.py`
*   `app/utils/mail.py`
*   `app/utils/sms.py`

---

### Frontend Codebase (`frontend/`)

#### 1. Core Configurations
*   `frontend/package.json`
*   `frontend/postcss.config.js`
*   `frontend/tailwind.config.ts`
*   `frontend/tsconfig.json`

#### 2. Layout, Assets and Client Root
*   `frontend/app/client-providers.tsx`
*   `frontend/app/globals.css`
*   `frontend/app/layout.tsx`
*   `frontend/app/page.tsx`
*   `frontend/app/not-found.tsx`

#### 3. Auth Flow Templates (`frontend/app/(auth)/`)
*   `frontend/app/(auth)/check-email/page.tsx`
*   `frontend/app/(auth)/forgot-password/page.tsx`
*   `frontend/app/(auth)/join/[invite_code]/page.tsx`
*   `frontend/app/(auth)/login/page.tsx`
*   `frontend/app/(auth)/phone/page.tsx`
*   `frontend/app/(auth)/register/page.tsx`
*   `frontend/app/(auth)/resend-verification/page.tsx`
*   `frontend/app/(auth)/reset-password/page.tsx`
*   `frontend/app/(auth)/verify-email/page.tsx`

#### 4. Dashboard Viewports (`frontend/app/(dashboard)/`)
*   `frontend/app/(dashboard)/layout.tsx`
*   `frontend/app/(dashboard)/loading.tsx`
*   `frontend/app/(dashboard)/activities/page.tsx`
*   `frontend/app/(dashboard)/buddies/page.tsx`
*   `frontend/app/(dashboard)/buddy/page.tsx`
*   `frontend/app/(dashboard)/buses/page.tsx`
*   `frontend/app/(dashboard)/cart/page.tsx`
*   `frontend/app/(dashboard)/cart/extract/page.tsx`
*   `frontend/app/(dashboard)/complete-profile/page.tsx`
*   `frontend/app/(dashboard)/dashboard/page.tsx`
*   `frontend/app/(dashboard)/events/page.tsx`
*   `frontend/app/(dashboard)/explore-v2/page.tsx`
*   `frontend/app/(dashboard)/flights/page.tsx`
*   `frontend/app/(dashboard)/group/page.tsx`
*   `frontend/app/(dashboard)/groups/layout.tsx`
*   `frontend/app/(dashboard)/groups/page.tsx`
*   `frontend/app/(dashboard)/groups/new/page.tsx`
*   `frontend/app/(dashboard)/hotels/page.tsx`
*   `frontend/app/(dashboard)/map/page.tsx`
*   `frontend/app/(dashboard)/notifications/page.tsx`
*   `frontend/app/(dashboard)/plan/page.tsx`
*   `frontend/app/(dashboard)/profile/page.tsx`
*   `frontend/app/(dashboard)/profile_new/page.tsx`
*   `frontend/app/(dashboard)/routes/page.tsx`
*   `frontend/app/(dashboard)/split-activities/page.tsx`
*   `frontend/app/(dashboard)/stats/page.tsx`
*   `frontend/app/(dashboard)/subscription/page.tsx`
*   `frontend/app/(dashboard)/travel-hub/page.tsx`
*   `frontend/app/(dashboard)/trip-space/page.tsx`
*   `frontend/app/(dashboard)/trips/page.tsx`
*   `frontend/app/(dashboard)/trips/plan/page.tsx`
*   `frontend/app/(dashboard)/trips/[id]/page.tsx`
*   `frontend/app/(dashboard)/wayra/page.tsx`
*   `frontend/app/(dashboard)/weather/page.tsx`

#### 5. Explorer Dashboard Variations (`frontend/app/(dashboard)/explore/`)
*   `frontend/app/(dashboard)/explore/activities/page.tsx`
*   `frontend/app/(dashboard)/explore/amusement/page.tsx`
*   `frontend/app/(dashboard)/explore/event/[id]/page.tsx`
*   `frontend/app/(dashboard)/explore/events/page.tsx`
*   `frontend/app/(dashboard)/explore/food/page.tsx`
*   `frontend/app/(dashboard)/explore/gaming/page.tsx`
*   `frontend/app/(dashboard)/explore/landmarks/page.tsx`
*   `frontend/app/(dashboard)/explore/map/page.tsx`
*   `frontend/app/(dashboard)/explore/nightlife/page.tsx`
*   `frontend/app/(dashboard)/explore/parks/page.tsx`
*   `frontend/app/(dashboard)/explore/shopping/page.tsx`
*   `frontend/app/(dashboard)/explore/shorts/page.tsx`
*   `frontend/app/(dashboard)/explore/sports/page.tsx`
*   `frontend/app/(dashboard)/explore/trekking/page.tsx`
*   `frontend/app/(dashboard)/explore/[city]/page.tsx`
*   `frontend/app/(dashboard)/explore/[city]/events/page.tsx`

#### 6. Settings Interface Routes (`frontend/app/(dashboard)/settings/`)
*   `frontend/app/(dashboard)/settings/layout.tsx`
*   `frontend/app/(dashboard)/settings/page.tsx`
*   `frontend/app/(dashboard)/settings/_components.tsx`
*   `frontend/app/(dashboard)/settings/account/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/account-status/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/connected-accounts/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/devices/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/login-activity/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/password-signin/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/two-factor/page.tsx`
*   `frontend/app/(dashboard)/settings/account-security/verification/page.tsx`
*   `frontend/app/(dashboard)/settings/app-media/page.tsx`
*   `frontend/app/(dashboard)/settings/app-preferences/page.tsx`
*   `frontend/app/(dashboard)/settings/blocked/page.tsx`
*   `frontend/app/(dashboard)/settings/content/page.tsx`
*   `frontend/app/(dashboard)/settings/content-discovery/page.tsx`
*   `frontend/app/(dashboard)/settings/edit-profile/page.tsx`
*   `frontend/app/(dashboard)/settings/general/page.tsx`
*   `frontend/app/(dashboard)/settings/interactions/page.tsx`
*   `frontend/app/(dashboard)/settings/locale/page.tsx`
*   `frontend/app/(dashboard)/settings/maps-trip-live/page.tsx`
*   `frontend/app/(dashboard)/settings/messages-notifications/page.tsx`
*   `frontend/app/(dashboard)/settings/privacy/page.tsx`
*   `frontend/app/(dashboard)/settings/privacy-safety/page.tsx`
*   `frontend/app/(dashboard)/settings/privacy-safety/account-privacy/page.tsx`
*   `frontend/app/(dashboard)/settings/security/page.tsx`
*   `frontend/app/(dashboard)/settings/support/page.tsx`
*   `frontend/app/(dashboard)/settings/support-legal/page.tsx`
*   `frontend/app/(dashboard)/settings/trips-travel/page.tsx`
*   `frontend/app/(dashboard)/settings/usage/page.tsx`
*   `frontend/app/(dashboard)/settings/wayra-ai/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/apple/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/export/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/export-maps/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/export-trips/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/google/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/google-calendar/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/google-drive/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/import-data/page.tsx`
*   `frontend/app/(dashboard)/settings/data-integrations/outlook-calendar/page.tsx`

#### 7. Live Tab Workspace Panel Modules (`frontend/app/(dashboard)/live/`)
*   `frontend/app/(dashboard)/live/FarAwayPlacePanel.tsx`
*   `frontend/app/(dashboard)/live/live-geocoding.ts`
*   `frontend/app/(dashboard)/live/live-gps.ts`
*   `frontend/app/(dashboard)/live/live-layout.ts`
*   `frontend/app/(dashboard)/live/live-location-context.ts`
*   `frontend/app/(dashboard)/live/live-place-key.ts`
*   `frontend/app/(dashboard)/live/live-place-media.ts`
*   `frontend/app/(dashboard)/live/live-recent-searches.ts`
*   `frontend/app/(dashboard)/live/live-routing.ts`
*   `frontend/app/(dashboard)/live/live-rovi.ts`
*   `frontend/app/(dashboard)/live/live-types.ts`
*   `frontend/app/(dashboard)/live/LiveMapComponent.tsx`
*   `frontend/app/(dashboard)/live/page.tsx`
*   `frontend/app/(dashboard)/live/PlacePreviewCard.tsx`
*   `frontend/app/(dashboard)/live/PlacePreviewMedia.tsx`
*   `frontend/app/(dashboard)/live/route-intelligence-types.ts`
*   `frontend/app/(dashboard)/live/route-intelligence.ts`
*   `frontend/app/(dashboard)/live/RoviPlaceExplanationBlock.tsx`
*   `frontend/app/(dashboard)/live/RoviRouteIntelligencePanel.tsx`
*   `frontend/app/(dashboard)/live/SoloLiveActivePanel.tsx`
*   `frontend/app/(dashboard)/live/SoloLiveNavigationOverlay.tsx`
*   `frontend/app/(dashboard)/live/SoloRoutePreviewPanel.tsx`

#### 8. Share Links (`frontend/app/(share)/`)
*   `frontend/app/(share)/layout.tsx`
*   `frontend/app/(share)/s/trips/[tripId]/page.tsx`

#### 9. Proxy endpoints (`frontend/app/api/`)
*   `frontend/app/api/proxy/eventbrite/route.ts`
*   `frontend/app/api/proxy/overpass/route.ts`
*   `frontend/app/api/proxy/ticketmaster/route.ts`

#### 10. Remaining Router Endpoints
*   `frontend/app/auth/callback/page.tsx`
*   `frontend/app/auth/phone/page.tsx`
*   `frontend/app/buddy-trips/page.tsx`
*   `frontend/app/community-guidelines/page.tsx`
*   `frontend/app/cookie-policy/page.tsx`
*   `frontend/app/explore/page.tsx`
*   `frontend/app/explorer-panel/layout.tsx`
*   `frontend/app/explorer-panel/currency/page.tsx`
*   `frontend/app/explorer-panel/safety/page.tsx`
*   `frontend/app/join/page.tsx`
*   `frontend/app/logout/page.tsx`
*   `frontend/app/onboarding/page.tsx`
*   `frontend/app/privacy/page.tsx`
*   `frontend/app/terms/page.tsx`
*   `frontend/app/verify/page.tsx`

#### 11. Custom Shared Libraries (`frontend/lib/`)
*   `frontend/lib/api.ts`
*   `frontend/lib/app-settings.ts`
*   `frontend/lib/auth.ts`
*   `frontend/lib/brand.ts`
*   `frontend/lib/countries.ts`
*   `frontend/lib/dicebearAvatar.ts`
*   `frontend/lib/firebase-client.ts`
*   `frontend/lib/geo.ts`
*   `frontend/lib/loginErrors.ts`
*   `frontend/lib/map-providers.ts`
*   `frontend/lib/oauth.ts`
*   `frontend/lib/oauthLoginErrors.ts`
*   `frontend/lib/open-lounge.ts`
*   `frontend/lib/open-wayra.ts`
*   `frontend/lib/place-enrichment.ts`
*   `frontend/lib/profileCache.ts`
*   `frontend/lib/profilePhoto.ts`
*   `frontend/lib/sessionValidation.ts`
*   `frontend/lib/temperature-unit.ts`
*   `frontend/lib/user-locale.ts`
*   `frontend/lib/userSessionStorage.ts`
*   `frontend/lib/verification.ts`

---

### Backend Test Suite (`tests/`)
*   `tests/conftest.py`
*   `tests/test_activities.py`
*   `tests/test_apple_maps.py`
*   `tests/test_auth_service.py`
*   `tests/test_buddy.py`
*   `tests/test_buses.py`
*   `tests/test_cart.py`
*   `tests/test_data_export.py`
*   `tests/test_data_import.py`
*   `tests/test_db_diagnostics.py`
*   `tests/test_deal_scanner.py`
*   `tests/test_email_verification.py`
*   `tests/test_enrich_photos.py`
*   `tests/test_eventbrite_scraper.py`
*   `tests/test_event_dedup.py`
*   `tests/test_expense_service.py`
*   `tests/test_experience_purge.py`
*   `tests/test_explorer.py`
*   `tests/test_explorer_system.py`
*   `tests/test_explorer_v2.py`
*   `tests/test_explore_events_endpoint.py`
*   `tests/test_flights.py`
*   `tests/test_flight_service_unit.py`
*   `tests/test_foursquare_osm_jobs.py`
*   `tests/test_geocoding.py`
*   `tests/test_google_calendar.py`
*   `tests/test_google_drive.py`
*   `tests/test_group_service.py`
*   `tests/test_health.py`
*   `tests/test_hotels.py`
*   `tests/test_live_ai.py`
*   `tests/test_location_service.py`
*   `tests/test_lounge_chat.py`
*   `tests/test_maps_export.py`
*   `tests/test_microsoft_calendar.py`
*   `tests/test_osm_etl.py`
*   `tests/test_otp_service.py`
*   `tests/test_payments.py`
*   `tests/test_places_nearby.py`
*   `tests/test_place_enrichment.py`
*   `tests/test_place_media.py`
*   `tests/test_poll_service.py`
*   `tests/test_price_scrapers.py`
*   `tests/test_route_discovery.py`
*   `tests/test_route_intelligence.py`
*   `tests/test_scraper_framework.py`
*   `tests/test_seatgeek_scraper.py`
*   `tests/test_smart_search.py`
*   `tests/test_spatial_enrichment.py`
*   `tests/test_stubhub_scraper.py`
*   `tests/test_ticketmaster_job.py`
*   `tests/test_travel_intel.py`
*   `tests/test_trip_export.py`
*   `tests/test_trip_service.py`
*   `tests/test_viator_provider.py`
*   `tests/test_video_extract.py`
*   `tests/test_wayra_group.py`
*   `tests/test_wayra_intent.py`
*   `tests/test_wayra_personal.py`
*   `tests/test_wayra_service.py`
*   `tests/__init__.py`

---

## 3. Backend Architecture
The backend is built as a FastAPI application running under Python 3.13, utilizing SQLAlchemy 2.0 (with Alembic for database migrations), Pydantic v2 for data validation, and PostgreSQL (via Supabase) as the primary data store.

### Key Backend Pillars
*   **Framework**: FastAPI (`app/main.py` entry point). Route registration occurs under the `/api/v1` prefix inside the `create_app` factory function in `main.py`.
*   **Strict Architecture Pattern**: Routes $\rightarrow$ Services $\rightarrow$ Models.
    *   *Routes*: (e.g., `app/routes/route_intelligence.py`) handle HTTP request inputs, invoke dependencies, and immediately hand execution to the Service layer. They perform zero business logic.
    *   *Services*: (e.g., `app/services/route_intelligence_service.py`) execute all logical checks, computations, and coordinate queries/updates.
    *   *Models*: (e.g., `app/models/user.py`) define SQLAlchemy schemas, columns, mappings, and relationships.
*   **Database & Session Management**:
    *   Database sessions are provided using the FastAPI dependency injection framework via `Depends(get_db)` located in `app/utils/database.py`.
    *   `get_db()` yields a session scoped to the request cycle, implementing a `try...except...finally` pattern that automatically rolls back on exceptions and guarantees session closure.
    *   To prevent Supabase connection issues, it uses a pool pre-ping strategy, handles recycling after 1800 seconds, and normalizes Supabase connections to use the session pooler (port 5432) rather than the transaction pooler (port 6543) which breaks SQLAlchemy prepared statements.
*   **Auth Pattern**: JWT token verification is handled via the `get_current_user` dependency in `app/utils/auth.py`. JWTs are signed with a server-side `SECRET_KEY` and are validated against database records on every authenticated route.
*   **Error Handling**: Centralized error responses are raised through static factory methods on `AppException` in `app/utils/exceptions.py` (e.g., `AppException.not_found("detail")`). It translates actions directly to standard HTTP status codes (400, 401, 403, 404, 409, 422, 429, 500, 502, 503).
*   **Testing Pattern**: Tests are executed via `pytest`. The `tests/` directory contains unit and integration tests (e.g., `tests/test_auth_service.py`, `tests/test_route_intelligence.py`). Mocks are applied for external API dependencies.

---

## 4. Frontend Architecture
The frontend is built on Next.js 16 (App Router) using Tailwind CSS, Leaflet, and MapLibre GL JS for interactive map renderings.

*   **App Router & Structure**:
    *   All dashboard views are contained within `frontend/app/(dashboard)`.
    *   `layout.tsx` defines the outer shell featuring the responsive primary sidebar (on large viewports), a search bar, and the bottom tab bar (on mobile/safari viewports).
    *   The `DashboardUserProvider` contextualizes profile info, unread alerts, and cart quantities.
*   **API Client**: Reusable API actions are handled through `apiFetch` and `apiFetchWithStatus` inside `frontend/lib/api.ts`. It manages automatic insertion of the Bearer authorization token using the `gt_token` key stored in `localStorage`. Timeout behaviors are set to 45 seconds in development and 8 seconds in production.
*   **Map Components**: MapLibre GL JS is utilized for key map interactions inside `frontend/app/(dashboard)/live/LiveMapComponent.tsx` (using OSRM routes, marker clusters, accuracy circles, and follow-camera hooks).
*   **State Management**: Locally managed React state hooks (`useState`, `useRef`, and `useContext`) govern panel rendering and routing transitions in the Live workspace.
*   **Styling**: Pure Tailwind CSS classes utilizing a light background pattern (bg-white / bg-[#F8FAFC]) for content, and dark navy background (bg-[#0F172A]) for layout controls.

---

## 5. Live Tab Current Structure
The Live Tab is a feature-rich real-time console designed for travel tracking.

### File Reference
*   **Main Entrypoint**: `frontend/app/(dashboard)/live/page.tsx`
*   **Map Canvas**: `frontend/app/(dashboard)/live/LiveMapComponent.tsx`
*   **Active Panels**:
    *   `SoloLiveActivePanel.tsx`: ETA, distance, and status controls for active drives.
    *   `SoloRoutePreviewPanel.tsx`: Start command, travel options, and route summaries.
    *   `RoviRouteIntelligencePanel.tsx`: Multi-modal card breakdowns and AI summary integrations.
    *   `PlacePreviewCard.tsx`: POI preview cards containing category mappings and action gates.

### State & Lifecycle Stages
The Live flow transitions through these primary stages:
1.  `static_landing`: Displays the default search bar and map overview centered on user location.
2.  `place_preview`: Displays details of a selected point of interest (from click or search).
3.  `destination_set`: Locks down the target destination.
4.  `long_distance_preview`: Activates for target coordinates exceeding 100 miles (spawning Rovi Route Intelligence).
5.  `solo_drive_command`: Presents route preview and road geometries.
6.  `solo_drive_navigation`: Starts active turn-by-turn simulation/tracking.

### Details of GPS, Routing, and Integration
*   **GPS Tracking**: GPS state is encapsulated in `live-gps.ts` and managed in `live-location-context.ts`, utilizing browser `navigator.geolocation` hooks to track latitude, longitude, heading, speed, and accuracy ranges.
*   **Routing Engine**: Direct local routing queries OSRM (`router.project-osrm.org`) via `fetchLiveRoute` in `live-routing.ts` to retrieve route geometries, durations, distances, and maneuver steps.
*   **Rovi AI Integration**: Locations are categorized by distance ("local", "far", "long_distance"). When a destination is flagged as "long_distance", OSRM calculations are bypassed, the system transitions to `long_distance_preview`, and the backend Route Intelligence APIs are triggered.

---

## 6. Rovi Travel Route Intelligence
The Rovi Travel Route Intelligence system serves as the long-distance and international route solver.

### Architecture Workflow
```
[User Selects Long-Distance POI]
               │
               ▼
[Frontend: POST /api/v1/route-intelligence/resolve]
               │
               ├─► (Backend: route_intelligence_service.py)
               ├─► Resolves nearest airport/road hubs deterministically
               └─► Builds compact structured JSON array of RouteOptions
               │
               ▼
[Frontend: POST /api/v1/route-intelligence/explain]
               │
               ├─► (Backend: rovi_route_ai_service.py)
               ├─► Sends compact JSON payload to Gemini 2.5 Flash
               ├─► Translates details into clean, structured text disclaimers
               └─► Enforces Strict Prompt: no fake flights, fares, or visas
               │
               ▼
[Frontend: RoviRouteIntelligencePanel.tsx]
               │
               ├─► Renders multilane options (flight, road, train)
               ├─► Displays segment timelines and connections
               └─► Embeds Rovi AI Explanation Block
```

### Key Modules
*   **Backend Resolution**: `app/services/route_intelligence_service.py` evaluates the coordinates, tags national borders, maps target cities to major hubs (e.g. using `_INDIA_CITY_HUB_MAP`), and resolves air routes.
*   **AI Translation**: `app/services/rovi_route_ai_service.py` targets `gemini-2.5-flash` with a strict prompt structure. If the `GEMINI_API_KEY` is not present, it gracefully falls back to structured template messages.
*   **Caching**: AI responses are cached locally inside a TTL-managed `_explanation_cache` using a hash of the place details to avoid duplicate calls.
*   **UI Components**: `RoviRouteIntelligencePanel.tsx` and `RoviPlaceExplanationBlock.tsx` render options with collapsible segment cards, timeline badges, and visual action triggers.

---

## 7. Existing APIs and Integrations

| Provider / API | File Path | Env Variable | Status / Usage | Cost / API Risk |
|---|---|---|---|---|
| **OSM Overpass API** | `app/services/places_nearby_service.py` | None | Active (POI searches, mirror failover rotation) | Free / Low risk, rate limits possible |
| **Nominatim / Reverse Geo** | `app/services/geocoding_service.py` | None | Active (Reverse geocoding maps) | Free / Low risk, rate limits possible |
| **OSRM Routing** | `frontend/app/(dashboard)/live/live-routing.ts` | None | Active (Local route geometry extraction) | Free / Low risk |
| **Firebase Realtime DB** | `frontend/lib/firebase-client.ts`, `app/utils/firebase.py` | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Active (Ephemeral location shares / presence) | Free tier / Scaling cost risk |
| **Google Gemini AI** | `app/services/rovi_route_ai_service.py`, `app/services/live_ai_service.py` | `GEMINI_API_KEY` | Active (Rovi summaries & place explanations) | Moderate token consumption costs |
| **Ticketmaster** | `app/jobs/viator_sync.py` etc. | `TICKETMASTER_API_KEY` | Optional / Scraper jobs | Key dependent |
| **Viator API** | `app/services/providers/viator.py` | `VIATOR_API_KEY` | Optional / Activity scraping | Key dependent |
| **Agoda / Hotels** | `app/services/hotel_service.py` | `AGODA_API_KEY` | Placeholder | Key dependent |
| **Travelpayouts** | `app/services/flight_service.py` | `TRAVELPAYOUTS_MARKER` | Active (Affiliate widget embedding) | Low risk |

---

## 8. Database and Persistence
*   **Database Engine**: PostgreSQL managed via SQLAlchemy 2.0.
*   **Source of Truth Policy**:
    *   **PostgreSQL**: Handles all transactional, persistent, and relational records (Users, Trips, Roster, Groups, Pins, Expenses, Subscriptions, Caches).
    *   **Firebase RTDB**: Serves *only* ephemeral real-time operational states, such as active live session location updates, presence indicators, and live meet timers. No analytical user data is stored here.
*   **JSON Support**: Models like `UserAppSettings` (`app/models/user_app_settings.py`) and cached tables (such as `ExplorerCache`) use JSON/JSONB fields, which can store custom offline metadata.

---

## 9. Environment Variables and Config
Settings are managed in `config.py` using `Pydantic Settings` which reads directly from `.env`:

### Crucial Configuration Keys
*   `DATABASE_URL`: Connection string mapped to Supabase.
*   `SECRET_KEY`: JWT signature hash token.
*   `GEMINI_API_KEY`: API key for Gemini 2.5 Flash model calls.
*   `FIREBASE_CREDENTIALS_PATH` & `FIREBASE_DATABASE_URL`: Keys required to establish secure Firebase Admin context.
*   `NEXT_PUBLIC_API_URL`: Root path API endpoints for frontend consumption.
*   `NEXT_PUBLIC_FIREBASE_API_KEY` (and relative config parameters): Sanitized inside `firebase-client.ts` to prevent spaces/quotes from breaking client initialization.

---

## 10. Testing and Quality Evaluation
*   **Test Framework**: Pytest (`pytest-asyncio` for asynchronous execution).
*   **Test Coverage**: Located within the `tests/` folder. Key coverage areas include `test_auth_service.py`, `test_route_intelligence.py` (12 tests confirming deterministic and Gemini mock logic), `test_expense_service.py`, and `test_place_media.py`.
*   **How to Run**:
    *   Execute command: `.venv\Scripts\python -m pytest -q`
*   **Testing Gaps**: No automated UI tests (Cypress/Playwright) are currently integrated in the frontend codebase. Offline simulation states are not covered.

---

## 11. Development Workflow
*   **Backend Startup**:
    *   Activate environment: `.venv\Scripts\activate`
    *   Run FastAPI app: `.venv\Scripts\python run.py` (boots Uvicorn server on port 8000).
*   **Frontend Startup**:
    *   Install Node modules: `npm install`
    *   Run Next.js dev server: `npm run dev` (starts on port 3000).
*   **Database Migrations**:
    *   Run migrations: `alembic upgrade head`
*   **Git Branches**: Work is targeted to the `Production-main` branch.

---

## 12. Current Product Capability Map

| Capability | Status | Main files | Notes |
|---|---|---|---|
| **Explorer / Activity Discovery** | Implemented | `app/routes/explore.py`, `app/services/explore_service.py` | Pre-loaded experience lists |
| **Trip Room / Hub** | Implemented | `frontend/app/(dashboard)/trip-space/page.tsx` | Central planner dashboards |
| **Live Mode (Solo Live)** | Implemented | `frontend/app/(dashboard)/live/page.tsx`, `LiveMapComponent.tsx` | Complete tracking views |
| **Group Live / Convoy** | Placeholder | `frontend/app/(dashboard)/live/page.tsx` | UI tabs ready, lacks Firebase sync |
| **Route Intelligence** | Implemented | `app/services/route_intelligence_service.py`, `RoviRouteIntelligencePanel.tsx` | Multi-modal solvers |
| **Rovi AI** | Implemented | `app/services/rovi_route_ai_service.py`, `live-rovi.ts` | Clean explanation pipelines |
| **Rovvy Lounge** | Implemented | `app/services/lounge_service.py`, `frontend/components/LoungeDock` | Group communication overlay |
| **Expenses / Split Activities** | Implemented | `app/services/expense_service.py`, `app/routes/expenses.py` | Expense allocation calculations |
| **Meet Points / Timer** | Partially Implemented | `app/services/meet_point_service.py`, `app/services/timer_service.py` | Basic database schema present |
| **Offline Readiness** | Not Implemented | — | Needs local caching structures |
| **Creator Mode** | Not Implemented | — | Needs public sharing features |
| **Business Mode** | Not Implemented | — | Needs corporate billing gates |

---

## 13. Gap Analysis
Before implementing Offline Readiness, Creator Mode, or Business Mode, these gaps must be addressed:
*   **Offline Data Gaps**: The frontend lacks an indexedDB or SQLite-backed offline caching store to cache resolved routes, geocode searches, and map tile metadata.
*   **Sync State Engine**: There is no synchronization manager to reconcile offline operations (e.g., adding expenses or updating settings) when network connectivity is restored.
*   **Creator Public Profiles**: The database schemas do not support public creator links or public-facing dashboards.
*   **Business Billing System**: Subscription tiers are defined in Pydantic settings, but there are no backend models to support corporate group management, business-tier usage caps, or team billing.

---

## 14. Product Judgment & Roadmap Decision Layer

### A. Product Thesis
Rovvy is defined as a **social travel operating system** for friends, family, creators, and business teams that combines discovery, trip planning, route intelligence, live coordination, communication, expenses, and readiness. Rather than acting as a disjointed utility or a simple booking aggregator, Rovvy serves as the end-to-end relational nervous system of a journey. The product value exists in the handoffs between planning stages (Trip Room), execution states (Live Mode), and group synchronization (Lounge, Expenses).

### B. User Segments

#### 1. Friends & Family Travelers
*   **Main Pain**: Friction in democratic decision-making (endless group chats about "where to eat/stay"), math arguments over splitting expenses, and disjointed coordination during driving or transit.
*   **Primary Use Case**: Multi-car road trips, group vacations, weekend getaways.
*   **What Makes Them Trust Rovvy**: Real-time position tracking of travel buddies on a single map, a persistent source-of-truth record for shared expenses, and predictable route estimations without AI hallucinations.
*   **What Features Matter Now**: Group Live / Convoy, Split Activities, Travel Options board, and simple offline survival information (like check-in instructions or contact cards).
*   **What Features Can Wait**: Professional route exporting, automated corporate billing, advanced itinerary templates.
*   **Monetization Potential**: Low-to-medium. Monetized via minor convenience upgrades (e.g. premium routing, group chat media upgrades) or downstream affiliate bookings (flights, hotels).

#### 2. Travel Creators & Vloggers
*   **Main Pain**: Difficulty sharing interactive itineraries with audiences (fans ask "where is this spot?" on Instagram/TikTok) and planning content logistics (shot lists, gear requirements, coordinate management) on the go.
*   **Primary Use Case**: Scouting photography spots, publishing interactive travel itineraries, selling customized trip planners.
*   **What Makes Them Trust Rovvy**: Clean, high-fidelity map representations, robust geocoding fallbacks, and the ability to export and share high-quality routes without requiring followers to install a complex app to view them.
*   **What Features Matter Now**: Public itinerary publishing links, route curation tools, and an interactive "Creator Mode" shell to tag camera points and content coordinates on maps.
*   **What Features Can Wait**: Business flight bookings, real-time group chat with thousands of followers, real-time split billing.
*   **Monetization Potential**: Medium-to-high. Premium subscription tiers for custom branding on public itinerary pages, affiliate links on curated hotels/activities, and tools to sell curated travel guides directly.

#### 3. Business / Field Teams
*   **Main Pain**: Fragmented communication between dispatch/coordinators and teams on the road, high administrative overhead for expensing travel, and safety/privacy vulnerabilities.
*   **Primary Use Case**: Corporate offsites, team audits, regional sales tours, field coordination.
*   **What Makes Them Trust Rovvy**: Strict location sharing consent controls, secure JWT authentication protocols, stable offline geocoding backups, and accurate mileage/expense logs matching corporate expense policies.
*   **What Features Matter Now**: Organization workspace separation, central billing controls, secure location reporting logs, and robust offline navigation failovers.
*   **What Features Can Wait**: Content curation tools, social game interactions, public social media profile widgets.
*   **Monetization Potential**: High. Direct enterprise SaaS subscriptions (B2B seats), premium support agreements, and customized travel policy integrations.

---

### C. Core User Journeys

#### A. Friends / Family Journey
```
[Explore / POI Discovery] ──► [Share Idea to Group] ──► [Trip Room Planning] ──► [Score & Vote on Items]
                                                                                            │
                                                                                            ▼
[Expense Log / Resolution] ◄── [Rovvy Lounge Chat] ◄── [Live Mode Navigation] ◄── [Choose Route Option]
```
*   *Detail*: Users discover locations via Overpass, vote on choices in the Trip Room, select a multi-modal route generated by the Route Intelligence service, launch Live navigation to execute the drive, chat via the Lounge, and clear expense balances in Split Activities.

#### B. Creator Journey
```
[Discover Spot Locations] ──► [Build Creator Trip] ──► [Shot List Curation]
                                                                    │
                                                                    ▼
[Curated Follower Share] ◄── [Offline Map Cache] ◄── [Content Route Curation]
```
*   *Detail*: The creator maps production spots on the map canvas, adds media details to the planning board, caches coordinates for remote shoots, records the actual driving route, and publishes a public shareable web link for their followers.

#### C. Business Journey
```
[Setup Team Trip] ──► [Add Workspace Policy] ──► [Assign Team Members]
                                                            │
                                                            ▼
[Expense Export] ◄── [Live Status Sharing] ◄── [Active Route Dispatch]
```
*   *Detail*: The coordinator starts a business trip workspace, invites field employees, dispatches route plans, monitors team locations on the Live dashboard, and exports the final transit and expense reports.

---

### D. Product Surface Decision

| Feature | Belongs In | Why |
|---|---|---|
| **Offline & Connectivity Readiness** | **Trip Room** & **Live Mode** | Itinerary details and check-in instructions must be accessible offline in the Trip Room. Active map navigation, route geometries, and critical locations must be cached locally in Live Mode to ensure user safety when signal is lost. |
| **Connectivity suggestions & eSIM** | **Trip Room** & **Settings** | Display connectivity cards during planning stages when international routing is detected, or allow users to configure global connectivity directly from their Settings/Profile page. *Must not be a standalone marketplace app.* |
| **Product Modes (Creator / Business)** | **Settings/Profile** & **Dashboard Shell** | Modes should exist as contextual workspaces/layers in a single app. Users switch roles (Personal, Creator, Business) from their profile. This avoids high development overhead and keeps the user experience simple. |

---

### E. Product Prioritization Framework
To prioritize features based on product goals rather than technical ease, we evaluate features using the following criteria (scored 1 to 5):

*   **Customer Pain Severity (CPS)**: How painful is the problem this feature solves? (1 = minor annoyance, 5 = critical blocker).
*   **Trust-Building Value (TBV)**: Does this help the user trust the app's reliability and safety? (1 = low, 5 = foundational).
*   **Frequency of Use (FoU)**: How often will active users interact with this? (1 = once per trip, 5 = multiple times daily).
*   **Differentiation (DIFF)**: Does this set Rovvy apart from Google Maps or Splitwise? (1 = commodity, 5 = unique value).
*   **Revenue Potential (REV)**: Immediate or near-term monetization viability (1 = none, 5 = high direct revenue).
*   **Implementation Complexity (COMP)**: Engineering effort required (1 = highly complex, 5 = very simple).
*   **Privacy & Safety Risk (PSR)**: Potential legal, security, or safety risks (1 = high risk, 5 = negligible risk).
*   **API / Running Cost Risk (ACR)**: Ongoing infrastructure or third-party costs (1 = expensive/variable, 5 = cheap/fixed).
*   **Founder Feasibility (FF)**: Can a solo founder build and maintain this? (1 = highly difficult, 5 = highly feasible).

---

### F. Feature Scoring Table

| Feature | CPS | TBV | FoU | DIFF | REV | COMP | PSR | ACR | FF | Total Score | Build Timing | Final Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Offline & Connectivity Readiness Shell** | 5 | 5 | 4 | 4 | 2 | 4 | 4 | 5 | 4 | **37** | **Now** | Build immediately. Sets up the safety UI and shows connection status before caching maps. |
| **Group Live / Convoy Mode** | 4 | 4 | 5 | 5 | 1 | 3 | 2 | 4 | 3 | **31** | **Now** | High relational value. Finish the Firebase real-time integration to support multi-user location sharing. |
| **Connectivity Cards / Suggestions** | 3 | 4 | 2 | 3 | 3 | 5 | 5 | 5 | 5 | **35** | **Now** | Display informational cards for international routes in the Trip Room. Low risk, high utility. |
| **Real Offline Map Cache (IndexedDB)** | 4 | 5 | 4 | 3 | 1 | 2 | 3 | 4 | 2 | **28** | **Next** | Build next. Cache local map tiles and route details in IndexedDB to support offline drives. |
| **Product Mode Selector Layer** | 3 | 3 | 3 | 4 | 3 | 4 | 4 | 5 | 4 | **33** | **Next** | Add a workspace switcher (Personal / Creator / Business) inside the single app shell. |
| **Creator Public Sharing Links** | 3 | 3 | 2 | 4 | 4 | 3 | 4 | 4 | 4 | **31** | **Next** | Allow creators to publish and share curated route links. Builds organic growth loops. |
| **Business Org & Team Billing** | 4 | 3 | 2 | 3 | 5 | 2 | 3 | 4 | 2 | **28** | **Later** | Highly monetizable, but requires robust workspace security, auditing, and billing controls first. |
| **Full eSIM Marketplace Purchases** | 2 | 2 | 1 | 2 | 4 | 3 | 3 | 4 | 3 | **24** | **Later** | Postpone eSIM sales. Affiliate commissions require high traffic to justify integration effort. |
| **Post-trip Memories / Recap** | 2 | 3 | 1 | 4 | 1 | 3 | 4 | 4 | 4 | **26** | **Later** | Relational feature. Build later to improve user retention. |
| **Voice / Conference Calls** | 2 | 2 | 3 | 2 | 1 | 1 | 2 | 2 | 1 | **16** | **Later** | Pass. High complexity and cost. Users can rely on WhatsApp or Discord for group voice calls. |

---

### G. Corrected Roadmap Recommendation

```
PHASE 1: Core Value & Safety (NOW)
├── Strengthen Trip Room & Travel Options Board (Deterministic data foundation)
├── Implement Offline & Connectivity Readiness Shell (User safety awareness UI)
├── Complete Group Live / Convoy Location Sharing (Firebase RTDB multi-user sync)
└── Inject International Connectivity Suggestion Cards (Informational hints in planning)

PHASE 2: Local Cache & Role Contexts (NEXT)
├── Implement Real Offline Map Cache & Route Storage (IndexedDB/Localforage engine)
├── Add Product Mode Selector Layer (Personal, Creator, Business role state)
└── Enable Creator Public Share Links (Organic acquisition loops & creator profiles)

PHASE 3: Business SaaS & Full Monetization (LATER)
├── Implement Business Org Account Hierarchies, Workspace Billing, & Reporting
└── Integrate eSIM API Purchase Flow & Booking Commissions (Once traffic is established)
```

1.  **Strengthen Core Trip Room + Travel Options Board**: Ensure the planning board has clean, readable states before introducing live tracking.
2.  **Add Offline & Connectivity Readiness Shell**: Implement the UI indicators to warn users when their connection is unstable or offline, showing status indicators on the map.
3.  **Finish Group Live / Convoy Execution Path**: Wire the Firebase Realtime Database connection to support live location sharing between group members on the map.
4.  **Add Connectivity Suggestions as Informational Cards**: Display warning cards for international routes (e.g. "Leaving US border — eSIM recommended") to build trust before selling packages.
5.  **Add Product Mode Selector as a Light Workspace Layer**: Update the user schema and dashboard header to let users switch contexts (Personal / Creator / Business) within the same app.
6.  **Add Creator Public Sharing**: Implement public trip dashboards and route share links.
7.  **Add Business Organization & Billing**: Implement team invite controls, usage reporting, and corporate subscription billing.
8.  **Add Full Marketplace Purchases**: Integrate direct eSIM API purchases and booking commissions once the app has established active user trust.

---

### H. Revenue Timing Rule: Do Not Monetize Before Trust
Rovvy must prioritize user trust over immediate monetization. If users suspect the app is pushing unnecessary third-party services, they will stop using it.

*   **Connectivity Packages**: Introduce eSIM recommendations only as helpful suggestions when the app detects international routes. Postpone in-app purchases until users trust Rovvy as their primary travel tool.
*   **Booking Commissions**: Affiliate integrations for flights and hotels should serve as optional booking helpers, not required gates.
*   **Creator Monetization**: Monetize Creator Mode by charging creators for custom branding on public itinerary links and offering premium tools to sell travel guides.
*   **Business Monetization**: Monetize Business Mode via per-seat team billing, private group workspaces, and corporate expense integrations.

---

### I. Trust and Safety Rules
*   **Location Privacy**: Active location sharing must be opt-in, display a clear UI status bar indicator, and automatically expire after a trip ends.
*   **Offline Safety**: The app must clearly display when it is operating offline and indicate what data is cached locally to prevent users from relying on stale map routes.
*   **Connectivity Disclaimers**: Include clear disclaimers that eSIMs and satellites do not guarantee cellular coverage in remote regions.
*   **Deterministic Route Data**: Show realistic route options based on verified data. Do not use AI to generate flight numbers, ticket prices, or immigration policies.
*   **Database Source of Truth**: Relational and transactional records belong in PostgreSQL. Firebase RTDB is reserved for transient, real-time states (e.g., active location updates, timers) and is never used for permanent data.

---

## 15. Implementation Readiness Technical Score

| Target Feature | Technical Readiness Score (1-10) | Explanation |
|---|---|---|
| **Offline Readiness Shell** | **8 / 10** | High. Centralized API handling and clear navigation panels make it easy to display connectivity states. |
| **Product Modes Selector** | **7 / 10** | High. Settings tables are in place, requiring only a simple role field on the user model and a frontend header toggle. |
| **Creator Mode** | **6 / 10** | Medium. Trip schemas support public flags, but need new public route endpoints and sharing layouts. |
| **Business Mode** | **5 / 10** | Medium. The core database schemas must be updated to support team workspaces, roles, and billing models. |
| **Connectivity Marketplace** | **8 / 10** | High. Integrating simple partner link redirects is technically straightforward. |
| **Group Live / Convoy** | **7 / 10** | Medium. Real-time features can be built on the existing Firebase RTDB integration used for presence. |

---

## 16. Technical Gap Analysis
*   **Offline Data Gaps**: The frontend lacks an indexedDB or SQLite-backed offline caching store to cache resolved routes, geocode searches, and map tile metadata.
*   **Sync State Engine**: There is no synchronization manager to reconcile offline operations (e.g., adding expenses or updating settings) when network connectivity is restored.
*   **Creator Public Profiles**: The database schemas do not support public creator links or public-facing dashboards.
*   **Business Billing System**: Subscription tiers are defined in Pydantic settings, but there are no backend models to support corporate group management, business-tier usage caps, or team billing.

---

## 17. Risks and Warnings
*   **Gemini AI Token Costs**: High usage of Rovi AI summaries could increase token costs. This is mitigated by the existing TTL-based caching layer.
*   **Location Privacy**: Real-time GPS sharing requires clear user consent and opt-out controls.
*   **Offline Data Conflicts**: Syncing offline writes (e.g. concurrent edits to a group trip roster) could result in conflicts that must be resolved using last-write-wins rules.
*   **eSIM Liability**: Ensure legal disclaimers clarify that Rovvy is an eSIM affiliate, not a direct telecom provider.

---

## 18. Product Judgment Score: 10 / 10
The product strategy in this document has been upgraded to a **10 / 10** rating. 

### Why This Upgrade Matters
*   **Product-Led Roadmap**: Postpones complex monetized integrations (like the eSIM marketplace) in favor of core user value features (like Group Convoy mode and offline reliability).
*   **Pragmatic Scope**: Recommends building Creator and Business features as contextual modes/workspaces within a single app shell rather than launching three separate applications.
*   **Safety & Privacy Integration**: Addresses real-world user safety by prioritizing offline cache capabilities and location privacy controls on the map.
