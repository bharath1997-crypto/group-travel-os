# Travel Tab — Scram Book

Authoritative planning and activity record for Rovvy Flights / Travel search.

## Artifacts

| File | Description |
|------|-------------|
| [Rovvy_Travel_Flights_Scrum_Plan.xlsx](./Rovvy_Travel_Flights_Scrum_Plan.xlsx) | Flights scrum plan |
| [Rovvy_Flights_Detailed_Product_Report.docx](./Rovvy_Flights_Detailed_Product_Report.docx) | Product report |
| [FL-045_WhiteLabel_Rollback.md](./FL-045_WhiteLabel_Rollback.md) | Travelpayouts white-label rollback |

## Activity log

### 2026-09-14 — CI flight search / booking unblocks

- **Context:** CI failed because provider selection, booking, and search dates were tied too tightly to runtime keys and today's date.
- **Goals:** Keep Duffel when it is enabled; skip only extra unconfigured providers; let mocked book/order routes reach the service; stop rejecting static test dates that have aged out.
- **Result:** `enabled_providers()` no longer empties the list when Amadeus (or another extra adapter) lacks credentials. Booking no longer 503s before `get_offer` / `create_order` / `get_order`. Production still returns 503 when the Duffel client itself has no key. Metasearch route-recovery tests use relative future dates; past-date validation stays in production.
- **Verification:** `pytest tests/test_flight_provider_registry.py tests/test_flight_booking.py tests/test_flight_metasearch.py tests/test_amadeus_provider.py tests/test_flight_journey_service_unit.py` — 91 passed (2026-09-14).
- **Risks:** Duffel remains listed when enabled even without an API key; search still reports unconfigured and 503s when every returned provider is unconfigured.
- **Next action:** Re-run the failing CI job on Production-main after this is pushed.
