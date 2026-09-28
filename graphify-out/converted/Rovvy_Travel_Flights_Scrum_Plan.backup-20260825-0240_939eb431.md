<!-- converted from Rovvy_Travel_Flights_Scrum_Plan.backup-20260825-0240.xlsx -->

## Sheet: Roadmap
| Rovvy Travel Unit — Flights Scrum Roadmap |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Six proposed two-week sprints · dates and working hours are editable planning assumptions |  |  |  |  |  |  |  |  |  |
| Sprint | Sprint Context | Goal Count | Feature Goals | Start | End | Planned Hours | Current Completion | Expected Result | Review Status |
| Sprint 1: Redirect-only product alignment | Rovvy is an aggregator, not the merchant of record. This sprint removes every public path and message that could make users believe Rovvy sells, issues, changes, cancels, or supports flight tickets. | 7 | G1.1 Make redirect-only behavior the single public Flights path | G1.2 Disable internal checkout entry points and booking CTAs | G1.3 Add consistent development-preview disclosure | G1.4 Allow guest comparison and provider handoff | G1.5 Replace booking language with comparison language | G1.6 Add provider-owned payment and support disclosure | G1.7 Regression tests for prohibited checkout paths and copy | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 |  | 0.41 | Public Flights journey is redirect-only; test inventory is non-bookable; product language is consistent. | In Progress |
| Sprint 2: Provider governance and safe handoff | Provider names and prices are trustworthy only when access is authorized and the handoff is safe. This sprint creates the lifecycle, authorization, environment, and redirect controls required before any seller is actionable. | 7 | G2.1 Enforce provider activation gate | G2.2 Separate registered, configured, enabled and actionable states | G2.3 Block non-actionable seller prices from selection | G2.4 Add authorization type and terms-review metadata | G2.5 Separate test and live seller presentation | G2.6 Implement redirect-domain allowlist and validation | G2.7 Provider failure and partial-result security tests | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 |  |  | Provider activation is governed; redirects are HTTPS, allowlisted and safe; failures remain transparent. | Pending |
| Sprint 3: Aggregation correctness | A provider may return several timings, and several providers may return the same itinerary. This sprint preserves distinct journeys while grouping only exact itinerary matches into comparable seller options. | 7 | G3.1 Expand itinerary fingerprint coverage | G3.2 Verify exact-match itinerary grouping | G3.3 Prevent near-match itinerary collisions | G3.4 Normalize currencies while preserving source values | G3.5 Define transparent seller ordering | G3.6 Add sanitized provider contract fixtures | G3.7 Expired and duplicate offer regression suite | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 |  |  | Exact matching flights group into seller options; distinct or expired journeys remain separate. | Pending |
| Sprint 4: Results experience and group usefulness | The results page must help solo and group travelers make a decision quickly. This sprint improves hierarchy, explanations, accessibility, responsive behavior, sharing, and post-booking Trip Space usefulness. | 7 | G4.1 Add search freshness and provider coverage summary | G4.2 Present itinerary with provider count and starting price | G4.3 Keep materially weaker alternatives collapsed | G4.4 Explain Rovvy recommendation reasons | G4.5 Design confirmed-flight attachment to Trip Space | G4.6 Accessibility and responsive visual regression | G4.7 Usability review with solo and group scenarios | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 |  |  | Compact accessible results clearly explain flight tradeoffs and support Trip Space planning. | Pending |
| Sprint 5: First authorized external source | Rovvy needs one lawful, provider-approved data source before presenting real offers. This sprint is deliberately limited to an adapter foundation and one authorized evaluation integration; named providers are not shown until permission and credentials exist. | 2 | G5.1 Complete the provider-neutral redirect adapter and authorization gate | G5.2 Connect and verify one authorized evaluation provider | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 |  |  | One authorized source returns real/test offers with an itinerary-specific external handoff. | Pending |
| Sprint 6: Release hardening and evidence package | The non-commercial preview must be stable enough for demonstrations and provider discussions. This sprint proves security, resilience, performance, disclosure quality, operational readiness, and release ownership. | 8 | G6.1 Create one release test command and CI quality gate | G6.2 Complete redirect, credential, logging and error security review | G6.3 Verify concurrent-provider performance | G6.4 Prove empty, stale, expired, timeout and partial-result behavior | G6.5 Prepare the product demonstration script | G6.6 Prepare the provider architecture and evidence brief | G6.7 Approve privacy, terms and development-preview disclosures | G6.8 Complete Product Owner release and rollback decision | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 |  |  | Rovvy demonstrates trustworthy comparison without internal booking, commissions or misleading data. | Pending |
| Overall planned window: August 24, 2026 – November 13, 2026. Standard working block: Monday–Friday, 9:00 AM–5:00 PM Central Time. Ceremony times are listed inside every sprint box. |  |  |  |  |  |  |  |  |  |
## Sheet: Sprint 1
| Sprint 1 — Redirect-only product alignment |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A user can search and compare flights without entering any Rovvy checkout flow. |  |  |  |  |  |  |  |  |  |
| Start Date | 2026-08-24 12:00:00 | End Date | 2026-09-04 12:00:00 | Workdays |  | Work Hours | 9:00 AM–5:00 PM CT | Planned Hours |  |
| EXPECTED SPRINT RESULT — Public Flights journey is redirect-only; test inventory is non-bookable; product language is consistent. |  |  |  |  |  |  |  |  |  |
| SPRINT CONTEXT |  |  |  |  |  |  |  |  |  |
| Rovvy is an aggregator, not the merchant of record. This sprint removes every public path and message that could make users believe Rovvy sells, issues, changes, cancels, or supports flight tickets. |  |  |  |  |  |  |  |  |  |
| Goal ID | Feature Goal |  |  | Result / Evidence |  |  |  | Related Items | Goal Review |
| G1.1 | Make redirect-only behavior the single public Flights path |  |  | Public comparison journey never enters Rovvy checkout |  |  |  | FL-001 | In Progress |
| G1.2 | Disable internal checkout entry points and booking CTAs |  |  | No public link reaches travelers, extras, review or payment |  |  |  | FL-002 | Not Started |
| G1.3 | Add consistent development-preview disclosure |  |  | Test status is visible before seller selection |  |  |  | FL-003 | Complete |
| G1.4 | Allow guest comparison and provider handoff |  |  | Authentication is not required to compare or redirect |  |  |  | FL-004 | In Progress |
| G1.5 | Replace booking language with comparison language |  |  | All public copy uses Compare providers / Continue to provider |  |  |  | FL-041 | In Progress |
| G1.6 | Add provider-owned payment and support disclosure |  |  | Responsibility is clear beside every future redirect |  |  |  | FL-044 | In Progress |
| G1.7 | Regression tests for prohibited checkout paths and copy |  |  | Automated tests prevent aggregator/OTA regression |  |  |  | QA-101 | Not Started |
| Ceremony / Work Block | Date or Recurrence | Time (CT) | Duration | Required Result | Ceremony / Work Block | Date | Time (CT) | Duration | Required Result |
| Sprint Planning | 2026-08-24 12:00:00 | 9:00–11:00 AM | 2 | Sprint goal, scope, owners and dependencies confirmed | Sprint Review | 2026-09-04 12:00:00 | 2:00–3:30 PM | 1.5 | Working increment demonstrated and result accepted/rejected |
| Daily Scrum | Every working day | 9:15–9:30 AM | 0.25 | Blockers and next 24-hour commitments recorded | Retrospective | 2026-09-04 12:00:00 | 3:30–4:30 PM | 1 | One improvement action assigned for next sprint |
| ID | Work Item | Owner | Est. Hours | Planned Start | Planned End | Expected Output / Result | Status | Priority | Review Notes |
| FL-001 | Make redirect-only behavior the single public Flights path | Product + Frontend | 14 | 2026-08-24 12:00:00 | 2026-08-28 12:00:00 | Public comparison journey never enters Rovvy checkout | In Progress | P0 | Comparison pages use redirect-oriented language, but Duffel provider_checkout still links to Rovvy offer/checkout. |
| FL-002 | Disable internal checkout entry points and booking CTAs | Frontend | 14 | 2026-08-24 12:00:00 | 2026-08-28 12:00:00 | No public link reaches travelers, extras, review or payment | Not Started | P0 | Internal offer, travelers, extras, review, payment, processing and confirmation pages remain directly reachable. |
| FL-003 | Add consistent development-preview disclosure | Product + Frontend | 8 | 2026-08-24 12:00:00 | 2026-08-28 12:00:00 | Test status is visible before seller selection | Complete | P0 | Trust strip and provider drawer clearly label Duffel/Amadeus test inventory; focused UI tests pass. |
| FL-004 | Allow guest comparison and provider handoff | Frontend | 10 | 2026-08-31 12:00:00 | 2026-09-04 12:00:00 | Authentication is not required to compare or redirect | In Progress | P0 | Guest search works. External redirects do not require sign-in, but provider_checkout currently sends guests to login. |
| FL-041 | Replace booking language with comparison language | Product | 10 | 2026-08-31 12:00:00 | 2026-09-04 12:00:00 | All public copy uses Compare providers / Continue to provider | In Progress | P0 | Landing/results copy is mostly comparison-first; internal checkout pages still say Complete your booking and Pay & Book. |
| FL-044 | Add provider-owned payment and support disclosure | Product + QA | 8 | 2026-08-31 12:00:00 | 2026-09-04 12:00:00 | Responsibility is clear beside every future redirect | In Progress | P0 | Some seller wording exists, but payment, ticket servicing, changes and cancellation ownership is not consistently disclosed beside every action. |
| QA-101 | Regression tests for prohibited checkout paths and copy | QA | 8 | 2026-08-31 12:00:00 | 2026-09-04 12:00:00 | Automated tests prevent aggregator/OTA regression | Not Started | P0 | 17 focused UI tests pass, but current assertions preserve provider_checkout/login behavior instead of prohibiting it. |
| SPRINT REVIEW BOX |  |  |  |  |  |  |  |  |  |
| Review Date | 2026-09-04 12:00:00 | Review Time | 2:00–3:30 PM CT | Result Status | In Progress | Completion | 0.41 | Reviewer | Product Owner |
| Actual Result | Re-audited Aug 23, 2026 at 3:52 PM CT: no redirect-only implementation change was found. Search/comparison, guest results and test disclosures remain working; Duffel provider_checkout can still enter Rovvy offer/checkout/payment. Sprint 1 remains 41% complete. |  |  |  |  |  |  |  |  |
| Decision / Follow-up | Continue Sprint 1. Frontend Flights checks: 17/17 passed. Backend flight-metasearch checks: 17/17 passed with one dependency warning. TypeScript did not pass because Explore Shorts exports formatCompactViews from a Next.js page; this is outside Sprint 1 but must be tracked separately. |  |  |  |  |  |  |  |  |
| CURRENT STATE AUDIT — WHAT ROVVY HAS DONE AND WHAT SPRINT 1 STILL REQUIRES |  |  |  |  |  |  |  |  |  |
| Goal | Implemented now |  |  | Remaining gap |  |  | Assessment | Evidence | Verified |
| G1.1 | Flights landing/results use compare-and-continue language; provider options are grouped in a drawer. |  |  | Duffel without a redirect is still converted to provider_checkout and links to /flights/offer. |  |  | In Progress | results/page.tsx; FlightOptionsDrawer.tsx | 2026-08-23 |
| G1.2 | No results-page CTA links directly to /flights/checkout. |  |  | Direct offer and checkout pages remain reachable and payment calls POST /flights/book. |  |  | Not Started | flights/offer; flights/checkout; flight_booking_service.py | 2026-08-23 |
| G1.3 | Trust strip and option cards identify test airline offers and Duffel sandbox; no real booking disclosure is visible. |  |  | Keep disclosure singular, consistent and impossible to confuse with live inventory. |  |  | Complete | FlightTrustStrip.tsx; FlightOptionsDrawer.tsx; 17 focused tests passed | 2026-08-23 |
| G1.4 | Search/results are available to guests; external redirects open without authentication. |  |  | provider_checkout still redirects a guest to login, so the public journey is not fully guest-compatible. |  |  | In Progress | FlightOptionsDrawer.tsx; flight-metasearch.test.ts | 2026-08-23 |
| G1.5 | Flights landing and results primarily use View options, Compare and Continue to provider language. |  |  | Publicly reachable checkout screens still say Complete your booking, Pay & Book and Rovvy Checkout. |  |  | In Progress | flights/page.tsx; checkout/layout.tsx; checkout/payment/page.tsx | 2026-08-23 |
| G1.6 | Landing text says the user completes booking with the selected seller. |  |  | Every actionable provider row needs explicit seller ownership for payment, ticketing, changes, cancellations and support. |  |  | In Progress | Flights landing/footer and provider drawer | 2026-08-23 |
| G1.7 | Focused metasearch/provider UI suite currently passes: 3 files, 17 tests. |  |  | Tests currently assert provider_checkout, login restoration and /flights/offer; replace them with redirect-only prohibitions and direct-route guards. |  |  | Not Started | Vitest 17 passed; pytest 17 passed; tests still expect provider_checkout; TypeScript blocked by unrelated Explore Shorts export | 2026-08-23 3:52 PM CT |
| CURSOR DELIVERY PLAN — REQUIRED WORK FOR SPRINT 1 |  |  |  |  |  |  |  |  |  |
| Step | Files / area |  |  | Required implementation |  |  | Acceptance evidence |  |  |
| 1 | flight provider normalizer + results fallback |  |  | Map offers to external_redirect only when a validated redirect URL exists; otherwise use unavailable. Never create provider_checkout in the public result model. |  |  | Backend and frontend tests prove a missing redirect cannot become an internal checkout action. |  |  |
| 2 | FlightOptionsDrawer.tsx |  |  | Remove login/auth restoration and internal /flights/offer links. Render external HTTPS handoff or a disabled test/unavailable state. |  |  | No getToken, authHref, providerCheckoutHref, Sign in to continue, or internal offer link remains. |  |  |
| 3 | Flights offer/checkout/booking pages |  |  | Add one disabled product-mode guard so direct public navigation returns to /flights (or not-found) without touching environment files. |  |  | Direct URLs cannot show traveler, extras, review, payment, processing or confirmation UI. |  |  |
| 4 | Public Flights copy |  |  | Use View options / Compare providers / Continue to provider consistently; add seller-owned payment, ticketing, changes, cancellations and support disclosure beside actions. |  |  | Static copy tests scan all public Flights entry points and prohibit Rovvy-booking language. |  |  |
| 5 | Regression tests |  |  | Rewrite frontend and backend tests that currently expect provider_checkout; add route-guard, guest redirect, missing-link, test-disclosure and prohibited-copy coverage. |  |  | Focused suites pass with zero assertions preserving internal checkout behavior. |  |  |
| 6 | Verification + records |  |  | Run focused frontend tests, relevant backend tests and TypeScript. Record exact results in this Sprint Review box and update the Feature/Test registries without inventing totals. |  |  | Commands, counts, failures and any carry-over are written into the workbook and project rule registries. |  |  |
| COPY-READY GPT / CURSOR PROMPT |  |  |  |  |  |  |  |  |  |
| TASK: Rovvy Flights — Complete Sprint 1: Redirect-only product alignment

AUTHORITATIVE PROJECT: D:\group travel os
READ FIRST: AGENTS.md, .cursorrules, GEMINI.md, CLAUDE.md, Scram Book\README.md, Scram Book\Travel Tab\Rovvy_Travel_Flights_Scrum_Plan.xlsx (Sprint 1), and Rovvy_Flights_Detailed_Product_Report.docx.

OBJECTIVE
Make the only public Flights journey: search → compare itineraries → view seller options → open the chosen authorized external provider. Rovvy must not collect traveler/payment data, create a flight order, or require sign-in merely to leave for a provider. Preserve existing brand and search/results UI unless a change is required for this boundary.

REQUIRED CHANGES
1. In provider normalization and the results fallback, emit external_redirect only for a validated HTTPS redirect URL. When no redirect exists (including Duffel sandbox), emit unavailable—not provider_checkout.
2. In FlightOptionsDrawer.tsx remove getToken/authHref/login restoration, providerCheckoutHref, internal /flights/offer navigation, and all provider_checkout CTAs. Show an external link only when actionable; otherwise show a disabled Test offer / external link unavailable state.
3. Add a centralized, disabled internal-checkout product-mode guard. Direct public visits to /flights/offer/*, /flights/checkout/* and /flights/booking/* must redirect to /flights or render not-found while Sprint 1 is active. Do not edit any .env file. Historical booking code may remain unreachable for reference.
4. Standardize public copy: View options, Compare providers, Continue to provider. Beside every enabled redirect state: “You’ll complete payment and manage tickets, changes, cancellations, and support with [seller]. Rovvy does not issue or service tickets.” Never show Complete your booking, Pay & Book, Secure booking through Rovvy, or similar claims on a reachable public Flights screen.
5. Replace tests that currently expect provider_checkout, /flights/offer login restoration, or sign-in-to-continue. Add regression coverage for: guest comparison/redirect, missing redirect disabled, sandbox disclosure, expired offer disabled, internal route guard, prohibited copy, and external HTTPS handoff.
6. Do not invent Priceline, Expedia, MakeMyTrip, EaseMyTrip, Agoda, airline-direct, or other sellers. A provider appears only with authorized configured data and a real itinerary-specific redirect. Do not scrape providers.

FILES TO INSPECT (not an automatic permission to rewrite unrelated code)
frontend/components/travel/FlightOptionsDrawer.tsx; frontend/app/(dashboard)/flights/results/page.tsx; frontend/app/(dashboard)/flights/offer/[offerId]/; frontend/app/(dashboard)/flights/checkout/; frontend/app/(dashboard)/flights/booking/; frontend/lib/__tests__/flight-metasearch.test.ts; frontend/lib/__tests__/flight-amadeus-ui.test.ts; app/services/flight_providers/normalizer.py; tests/test_flight_metasearch.py.

VERIFICATION
Run the focused Flights frontend tests, relevant backend flight-metasearch tests, and npx tsc --noEmit. Report exact commands and results. Search reachable public Flights files for prohibited booking language and internal checkout links. Update GEMINI.md/.cursorrules registries only with verified totals. Update Sprint 1 in the Scram Book with actual evidence, completion percentage, carry-over, and review decision.

DEFINITION OF DONE
No public result or provider option can enter Rovvy checkout; no guest is asked to sign in to redirect; test offers without links are disabled and honest; provider responsibility is explicit; direct internal checkout URLs are blocked; regression tests prevent reversal. |  |  |  |  |  |  |  |  |  |
| SPRINT 1 DECISION — Continue implementation. Do not close Sprint 1 until the public provider_checkout path and direct internal checkout routes are removed or guarded, and the revised regression suite passes. |  |  |  |  |  |  |  |  |  |
| LATEST SPRINT 1 VERIFICATION — AUGUST 23, 2026 · 3:52 PM CT |  |  |  |  |  |  |  |  |  |
| Check | Command / Scope |  |  | Result |  |  | Impact on Sprint 1 | Status | Owner / Follow-up |
| Code re-audit | FlightOptionsDrawer, results fallback, normalizer, internal offer/checkout/booking routes and matching tests |  |  | No relevant implementation change since the prior Sprint 1 audit. |  |  | Sprint status and completion remain unchanged. | Open | Cursor: execute the copy-ready prompt |
| Frontend focused tests | Vitest: flight-metasearch, flight-provider-ui and flight-amadeus-ui |  |  | 3 files passed; 17 tests passed in 559 ms. |  |  | Baseline is green, but assertions still preserve provider_checkout/login behavior. | Passed with gap | Rewrite tests during Sprint 1 |
| Backend focused tests | pytest -q tests/test_flight_metasearch.py |  |  | 17 tests passed in 1.10 s; one PendingDeprecationWarning from Starlette multipart import. |  |  | Baseline is green, but test_duffel_missing_redirect_uses_provider_checkout must be reversed. | Passed with gap | Rewrite test during Sprint 1 |
| Frontend types | tsc --noEmit |  |  | Failed: Explore Shorts page exports formatCompactViews, which Next.js page typing rejects. |  |  | Not caused by Flights Sprint 1; do not misreport the project typecheck as passing. | Blocked elsewhere | Track Explore Shorts separately |
| Sprint decision | Product Owner gate |  |  | Do not accept or close Sprint 1 yet. |  |  | Public provider_checkout and direct internal checkout routes remain unresolved. | Continue | Complete FL-001, FL-002, FL-004, FL-041, FL-044 and QA-101 |
## Sheet: Sprint 2
| Sprint 2 — Provider governance and safe handoff |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Only authorized, configured and actionable providers can appear as selectable sellers. |  |  |  |  |  |  |  |  |  |
| Start Date | 2026-09-07 12:00:00 | End Date | 2026-09-18 12:00:00 | Workdays |  | Work Hours | 9:00 AM–5:00 PM CT | Planned Hours |  |
| EXPECTED SPRINT RESULT — Provider activation is governed; redirects are HTTPS, allowlisted and safe; failures remain transparent. |  |  |  |  |  |  |  |  |  |
| SPRINT CONTEXT |  |  |  |  |  |  |  |  |  |
| Provider names and prices are trustworthy only when access is authorized and the handoff is safe. This sprint creates the lifecycle, authorization, environment, and redirect controls required before any seller is actionable. |  |  |  |  |  |  |  |  |  |
| Goal ID | Feature Goal |  |  | Result / Evidence |  |  |  | Related Items | Goal Review |
| G2.1 | Enforce provider activation gate |  |  | Only configured + enabled + authorized + actionable sellers appear |  |  |  | FL-010 | Pending |
| G2.2 | Separate registered, configured, enabled and actionable states |  |  | Provider directory accurately reports lifecycle state |  |  |  | FL-011 | Pending |
| G2.3 | Block non-actionable seller prices from selection |  |  | Unavailable sellers have no Continue action |  |  |  | FL-012 | Pending |
| G2.4 | Add authorization type and terms-review metadata |  |  | Every production provider has auditable authorization metadata |  |  |  | FL-013 | Pending |
| G2.5 | Separate test and live seller presentation |  |  | Sandbox results cannot visually impersonate live inventory |  |  |  | FL-045 | Pending |
| G2.6 | Implement redirect-domain allowlist and validation |  |  | Unknown, non-HTTPS and malformed redirects are blocked |  |  |  | FL-071 | Pending |
| G2.7 | Provider failure and partial-result security tests |  |  | One failed provider does not hide successful results |  |  |  | QA-201 | Pending |
| Ceremony / Work Block | Date or Recurrence | Time (CT) | Duration | Required Result | Ceremony / Work Block | Date | Time (CT) | Duration | Required Result |
| Sprint Planning | 2026-09-07 12:00:00 | 9:00–11:00 AM | 2 | Sprint goal, scope, owners and dependencies confirmed | Sprint Review | 2026-09-18 12:00:00 | 2:00–3:30 PM | 1.5 | Working increment demonstrated and result accepted/rejected |
| Daily Scrum | Every working day | 9:15–9:30 AM | 0.25 | Blockers and next 24-hour commitments recorded | Retrospective | 2026-09-18 12:00:00 | 3:30–4:30 PM | 1 | One improvement action assigned for next sprint |
| ID | Work Item | Owner | Est. Hours | Planned Start | Planned End | Expected Output / Result | Status | Priority | Review Notes |
| FL-010 | Enforce provider activation gate | Backend | 14 | 2026-09-07 12:00:00 | 2026-09-11 12:00:00 | Only configured + enabled + authorized + actionable sellers appear | Not Started | P0 |  |
| FL-011 | Separate registered, configured, enabled and actionable states | Backend | 10 | 2026-09-07 12:00:00 | 2026-09-11 12:00:00 | Provider directory accurately reports lifecycle state | Not Started | P0 |  |
| FL-012 | Block non-actionable seller prices from selection | Backend + Frontend | 10 | 2026-09-07 12:00:00 | 2026-09-11 12:00:00 | Unavailable sellers have no Continue action | Not Started | P0 |  |
| FL-013 | Add authorization type and terms-review metadata | Product + Backend | 10 | 2026-09-14 12:00:00 | 2026-09-18 12:00:00 | Every production provider has auditable authorization metadata | Not Started | P1 |  |
| FL-045 | Separate test and live seller presentation | Frontend | 10 | 2026-09-14 12:00:00 | 2026-09-18 12:00:00 | Sandbox results cannot visually impersonate live inventory | Not Started | P0 |  |
| FL-071 | Implement redirect-domain allowlist and validation | Security + Backend | 14 | 2026-09-14 12:00:00 | 2026-09-18 12:00:00 | Unknown, non-HTTPS and malformed redirects are blocked | Not Started | P0 |  |
| QA-201 | Provider failure and partial-result security tests | QA | 8 | 2026-09-14 12:00:00 | 2026-09-18 12:00:00 | One failed provider does not hide successful results | Not Started | P0 |  |
| SPRINT REVIEW BOX |  |  |  |  |  |  |  |  |  |
| Review Date | 2026-09-18 12:00:00 | Review Time | 2:00–3:30 PM CT | Result Status | Pending | Completion |  | Reviewer | Product Owner |
| Actual Result | Enter the demonstrated sprint outcome |  |  |  |  |  |  |  |  |
| Decision / Follow-up | Enter accepted changes, carry-over items and owner |  |  |  |  |  |  |  |  |
## Sheet: Sprint 3
| Sprint 3 — Aggregation correctness |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Matching offers are grouped accurately without merging different journeys. |  |  |  |  |  |  |  |  |  |
| Start Date | 2026-09-21 12:00:00 | End Date | 2026-10-02 12:00:00 | Workdays |  | Work Hours | 9:00 AM–5:00 PM CT | Planned Hours |  |
| EXPECTED SPRINT RESULT — Exact matching flights group into seller options; distinct or expired journeys remain separate. |  |  |  |  |  |  |  |  |  |
| SPRINT CONTEXT |  |  |  |  |  |  |  |  |  |
| A provider may return several timings, and several providers may return the same itinerary. This sprint preserves distinct journeys while grouping only exact itinerary matches into comparable seller options. |  |  |  |  |  |  |  |  |  |
| Goal ID | Feature Goal |  |  | Result / Evidence |  |  |  | Related Items | Goal Review |
| G3.1 | Expand itinerary fingerprint coverage |  |  | Codeshare, time-zone, terminal and overnight cases are covered |  |  |  | FL-021 | Pending |
| G3.2 | Verify exact-match itinerary grouping |  |  | Same flight from two providers appears once |  |  |  | FL-022 | Pending |
| G3.3 | Prevent near-match itinerary collisions |  |  | Different flight numbers/dates/connections never merge |  |  |  | FL-023 | Pending |
| G3.4 | Normalize currencies while preserving source values |  |  | Comparison is consistent and auditable |  |  |  | FL-024 | Pending |
| G3.5 | Define transparent seller ordering |  |  | Ordering considers price, freshness and disclosure completeness |  |  |  | FL-025 | Pending |
| G3.6 | Add sanitized provider contract fixtures |  |  | Provider normalizers are repeatably tested |  |  |  | FL-073 | Pending |
| G3.7 | Expired and duplicate offer regression suite |  |  | Expired offers cannot set the starting price |  |  |  | QA-301 | Pending |
| Ceremony / Work Block | Date or Recurrence | Time (CT) | Duration | Required Result | Ceremony / Work Block | Date | Time (CT) | Duration | Required Result |
| Sprint Planning | 2026-09-21 12:00:00 | 9:00–11:00 AM | 2 | Sprint goal, scope, owners and dependencies confirmed | Sprint Review | 2026-10-02 12:00:00 | 2:00–3:30 PM | 1.5 | Working increment demonstrated and result accepted/rejected |
| Daily Scrum | Every working day | 9:15–9:30 AM | 0.25 | Blockers and next 24-hour commitments recorded | Retrospective | 2026-10-02 12:00:00 | 3:30–4:30 PM | 1 | One improvement action assigned for next sprint |
| ID | Work Item | Owner | Est. Hours | Planned Start | Planned End | Expected Output / Result | Status | Priority | Review Notes |
| FL-021 | Expand itinerary fingerprint coverage | Backend | 16 | 2026-09-21 12:00:00 | 2026-09-25 12:00:00 | Codeshare, time-zone, terminal and overnight cases are covered | Not Started | P0 |  |
| FL-022 | Verify exact-match itinerary grouping | Backend | 12 | 2026-09-21 12:00:00 | 2026-09-25 12:00:00 | Same flight from two providers appears once | Not Started | P0 |  |
| FL-023 | Prevent near-match itinerary collisions | Backend + QA | 14 | 2026-09-21 12:00:00 | 2026-09-25 12:00:00 | Different flight numbers/dates/connections never merge | Not Started | P0 |  |
| FL-024 | Normalize currencies while preserving source values | Backend | 12 | 2026-09-28 12:00:00 | 2026-10-02 12:00:00 | Comparison is consistent and auditable | Not Started | P1 |  |
| FL-025 | Define transparent seller ordering | Product + Backend | 10 | 2026-09-28 12:00:00 | 2026-10-02 12:00:00 | Ordering considers price, freshness and disclosure completeness | Not Started | P1 |  |
| FL-073 | Add sanitized provider contract fixtures | QA | 10 | 2026-09-28 12:00:00 | 2026-10-02 12:00:00 | Provider normalizers are repeatably tested | Not Started | P1 |  |
| QA-301 | Expired and duplicate offer regression suite | QA | 6 | 2026-09-28 12:00:00 | 2026-10-02 12:00:00 | Expired offers cannot set the starting price | Not Started | P0 |  |
| SPRINT REVIEW BOX |  |  |  |  |  |  |  |  |  |
| Review Date | 2026-10-02 12:00:00 | Review Time | 2:00–3:30 PM CT | Result Status | Pending | Completion |  | Reviewer | Product Owner |
| Actual Result | Enter the demonstrated sprint outcome |  |  |  |  |  |  |  |  |
| Decision / Follow-up | Enter accepted changes, carry-over items and owner |  |  |  |  |  |  |  |  |
## Sheet: Sprint 4
| Sprint 4 — Results experience and group usefulness |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Travelers can quickly understand, compare and share the strongest options. |  |  |  |  |  |  |  |  |  |
| Start Date | 2026-10-05 12:00:00 | End Date | 2026-10-16 12:00:00 | Workdays |  | Work Hours | 9:00 AM–5:00 PM CT | Planned Hours |  |
| EXPECTED SPRINT RESULT — Compact accessible results clearly explain flight tradeoffs and support Trip Space planning. |  |  |  |  |  |  |  |  |  |
| SPRINT CONTEXT |  |  |  |  |  |  |  |  |  |
| The results page must help solo and group travelers make a decision quickly. This sprint improves hierarchy, explanations, accessibility, responsive behavior, sharing, and post-booking Trip Space usefulness. |  |  |  |  |  |  |  |  |  |
| Goal ID | Feature Goal |  |  | Result / Evidence |  |  |  | Related Items | Goal Review |
| G4.1 | Add search freshness and provider coverage summary |  |  | Users understand coverage and last checked state |  |  |  | FL-033 | Pending |
| G4.2 | Present itinerary with provider count and starting price |  |  | One card communicates the essential decision |  |  |  | FL-040 | Pending |
| G4.3 | Keep materially weaker alternatives collapsed |  |  | Strong results lead; alternatives remain discoverable |  |  |  | FL-042 | Pending |
| G4.4 | Explain Rovvy recommendation reasons |  |  | Recommendation logic is understandable |  |  |  | FL-043 | Pending |
| G4.5 | Design confirmed-flight attachment to Trip Space |  |  | External booking can be recorded without Rovvy servicing it |  |  |  | FL-060 | Pending |
| G4.6 | Accessibility and responsive visual regression |  |  | Keyboard, mobile and no-overflow requirements pass |  |  |  | FL-072 | Pending |
| G4.7 | Usability review with solo and group scenarios |  |  | Review findings and decisions are recorded |  |  |  | UX-401 | Pending |
| Ceremony / Work Block | Date or Recurrence | Time (CT) | Duration | Required Result | Ceremony / Work Block | Date | Time (CT) | Duration | Required Result |
| Sprint Planning | 2026-10-05 12:00:00 | 9:00–11:00 AM | 2 | Sprint goal, scope, owners and dependencies confirmed | Sprint Review | 2026-10-16 12:00:00 | 2:00–3:30 PM | 1.5 | Working increment demonstrated and result accepted/rejected |
| Daily Scrum | Every working day | 9:15–9:30 AM | 0.25 | Blockers and next 24-hour commitments recorded | Retrospective | 2026-10-16 12:00:00 | 3:30–4:30 PM | 1 | One improvement action assigned for next sprint |
| ID | Work Item | Owner | Est. Hours | Planned Start | Planned End | Expected Output / Result | Status | Priority | Review Notes |
| FL-033 | Add search freshness and provider coverage summary | Frontend | 10 | 2026-10-05 12:00:00 | 2026-10-09 12:00:00 | Users understand coverage and last checked state | Not Started | P1 |  |
| FL-040 | Present itinerary with provider count and starting price | Frontend | 14 | 2026-10-05 12:00:00 | 2026-10-09 12:00:00 | One card communicates the essential decision | Not Started | P0 |  |
| FL-042 | Keep materially weaker alternatives collapsed | Frontend | 8 | 2026-10-05 12:00:00 | 2026-10-09 12:00:00 | Strong results lead; alternatives remain discoverable | Not Started | P1 |  |
| FL-043 | Explain Rovvy recommendation reasons | Product + Frontend | 10 | 2026-10-12 12:00:00 | 2026-10-16 12:00:00 | Recommendation logic is understandable | Not Started | P1 |  |
| FL-060 | Design confirmed-flight attachment to Trip Space | Product + Full Stack | 18 | 2026-10-12 12:00:00 | 2026-10-16 12:00:00 | External booking can be recorded without Rovvy servicing it | Not Started | P1 |  |
| FL-072 | Accessibility and responsive visual regression | QA + Frontend | 12 | 2026-10-12 12:00:00 | 2026-10-16 12:00:00 | Keyboard, mobile and no-overflow requirements pass | Not Started | P1 |  |
| UX-401 | Usability review with solo and group scenarios | Product | 6 | 2026-10-12 12:00:00 | 2026-10-16 12:00:00 | Review findings and decisions are recorded | Not Started | P1 |  |
| SPRINT REVIEW BOX |  |  |  |  |  |  |  |  |  |
| Review Date | 2026-10-16 12:00:00 | Review Time | 2:00–3:30 PM CT | Result Status | Pending | Completion |  | Reviewer | Product Owner |
| Actual Result | Enter the demonstrated sprint outcome |  |  |  |  |  |  |  |  |
| Decision / Follow-up | Enter accepted changes, carry-over items and owner |  |  |  |  |  |  |  |  |
## Sheet: Sprint 5
| Sprint 5 — First authorized external source |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Activate one genuine redirect-capable provider or metasearch feed in evaluation mode. |  |  |  |  |  |  |  |  |  |
| Start Date | 2026-10-19 12:00:00 | End Date | 2026-10-30 12:00:00 | Workdays |  | Work Hours | 9:00 AM–5:00 PM CT | Planned Hours |  |
| EXPECTED SPRINT RESULT — One authorized source returns real/test offers with an itinerary-specific external handoff. |  |  |  |  |  |  |  |  |  |
| SPRINT CONTEXT |  |  |  |  |  |  |  |  |  |
| Rovvy needs one lawful, provider-approved data source before presenting real offers. This sprint is deliberately limited to an adapter foundation and one authorized evaluation integration; named providers are not shown until permission and credentials exist. |  |  |  |  |  |  |  |  |  |
| Goal ID | Feature Goal |  |  | Result / Evidence |  |  |  | Related Items | Goal Review |
| G5.1 | Complete the provider-neutral redirect adapter and authorization gate |  |  | A reusable adapter requires permission, environment, freshness, branding, rate-limit and handoff metadata before activation. |  |  |  | FL-050, PR-501, SEC-501 | Pending |
| G5.2 | Connect and verify one authorized evaluation provider |  |  | One approved source returns genuine evaluation offers, degrades safely and redirects to an itinerary-specific provider page. |  |  |  | FL-051, QA-501, OBS-501, DOC-501 | Pending |
| Ceremony / Work Block | Date or Recurrence | Time (CT) | Duration | Required Result | Ceremony / Work Block | Date | Time (CT) | Duration | Required Result |
| Sprint Planning | 2026-10-19 12:00:00 | 9:00–11:00 AM | 2 | Sprint goal, scope, owners and dependencies confirmed | Sprint Review | 2026-10-30 12:00:00 | 2:00–3:30 PM | 1.5 | Working increment demonstrated and result accepted/rejected |
| Daily Scrum | Every working day | 9:15–9:30 AM | 0.25 | Blockers and next 24-hour commitments recorded | Retrospective | 2026-10-30 12:00:00 | 3:30–4:30 PM | 1 | One improvement action assigned for next sprint |
| ID | Work Item | Owner | Est. Hours | Planned Start | Planned End | Expected Output / Result | Status | Priority | Review Notes |
| FL-050 | Finalize redirect-only provider adapter template | Backend | 14 | 2026-10-19 12:00:00 | 2026-10-23 12:00:00 | Adapter contract requires valid handoff metadata | Not Started | P0 |  |
| FL-051 | Integrate selected authorized evaluation feed | Backend | 24 | 2026-10-19 12:00:00 | 2026-10-23 12:00:00 | Authorized offers enter the coordinator | Blocked - Access | P1 |  |
| PR-501 | Document provider permission and branding requirements | Product | 8 | 2026-10-19 12:00:00 | 2026-10-23 12:00:00 | Access evidence and obligations are auditable | Blocked - Access | P0 |  |
| SEC-501 | Secure credentials and redact provider errors | Security + Backend | 10 | 2026-10-26 12:00:00 | 2026-10-30 12:00:00 | Secrets never reach client or logs | Not Started | P0 |  |
| QA-501 | Provider contract and redirect tests | QA | 12 | 2026-10-26 12:00:00 | 2026-10-30 12:00:00 | Sanitized responses and safe handoffs pass | Blocked - Access | P0 |  |
| OBS-501 | Provider latency, failure and rate-limit telemetry | Backend | 8 | 2026-10-26 12:00:00 | 2026-10-30 12:00:00 | Evaluation behavior is measurable | Not Started | P1 |  |
| DOC-501 | Provider integration runbook | Product + Engineering | 4 | 2026-10-26 12:00:00 | 2026-10-30 12:00:00 | Next providers can follow a repeatable process | Not Started | P1 |  |
| SPRINT REVIEW BOX |  |  |  |  |  |  |  |  |  |
| Review Date | 2026-10-30 12:00:00 | Review Time | 2:00–3:30 PM CT | Result Status | Pending | Completion |  | Reviewer | Product Owner |
| Actual Result | Enter the demonstrated sprint outcome |  |  |  |  |  |  |  |  |
| Decision / Follow-up | Enter accepted changes, carry-over items and owner |  |  |  |  |  |  |  |  |
## Sheet: Sprint 6
| Sprint 6 — Release hardening and evidence package |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Produce a stable non-commercial Flights preview ready for provider discussions. |  |  |  |  |  |  |  |  |  |
| Start Date | 2026-11-02 12:00:00 | End Date | 2026-11-13 12:00:00 | Workdays |  | Work Hours | 9:00 AM–5:00 PM CT | Planned Hours |  |
| EXPECTED SPRINT RESULT — Rovvy demonstrates trustworthy comparison without internal booking, commissions or misleading data. |  |  |  |  |  |  |  |  |  |
| SPRINT CONTEXT |  |  |  |  |  |  |  |  |  |
| The non-commercial preview must be stable enough for demonstrations and provider discussions. This sprint proves security, resilience, performance, disclosure quality, operational readiness, and release ownership. |  |  |  |  |  |  |  |  |  |
| Goal ID | Feature Goal |  |  | Result / Evidence |  |  |  | Related Items | Goal Review |
| G6.1 | Create one release test command and CI quality gate |  |  | All P0 flight tests run consistently before release. |  |  |  | FL-070 | Pending |
| G6.2 | Complete redirect, credential, logging and error security review |  |  | No critical security issue remains and secrets never reach users or logs. |  |  |  | SEC-601 | Pending |
| G6.3 | Verify concurrent-provider performance |  |  | Timeouts, provider deadlines and partial results meet agreed targets. |  |  |  | PERF-601 | Pending |
| G6.4 | Prove empty, stale, expired, timeout and partial-result behavior |  |  | End-to-end evidence demonstrates safe degradation for every critical failure mode. |  |  |  | QA-601 | Pending |
| G6.5 | Prepare the product demonstration script |  |  | The redirect-only experience can be shown consistently without implying live booking. |  |  |  | DOC-601 | Pending |
| G6.6 | Prepare the provider architecture and evidence brief |  |  | Potential partners can understand the data flow, controls and integration contract. |  |  |  | DOC-601 | Pending |
| G6.7 | Approve privacy, terms and development-preview disclosures |  |  | Public wording accurately explains Rovvy's role and the provider's responsibility. |  |  |  | LEGAL-601 | Pending |
| G6.8 | Complete Product Owner release and rollback decision |  |  | The release decision, unresolved risks, rollback steps and accountable owners are recorded. |  |  |  | REL-601 | Pending |
| Ceremony / Work Block | Date or Recurrence | Time (CT) | Duration | Required Result | Ceremony / Work Block | Date | Time (CT) | Duration | Required Result |
| Sprint Planning | 2026-11-02 12:00:00 | 9:00–11:00 AM | 2 | Sprint goal, scope, owners and dependencies confirmed | Sprint Review | 2026-11-13 12:00:00 | 2:00–3:30 PM | 1.5 | Working increment demonstrated and result accepted/rejected |
| Daily Scrum | Every working day | 9:15–9:30 AM | 0.25 | Blockers and next 24-hour commitments recorded | Retrospective | 2026-11-13 12:00:00 | 3:30–4:30 PM | 1 | One improvement action assigned for next sprint |
| ID | Work Item | Owner | Est. Hours | Planned Start | Planned End | Expected Output / Result | Status | Priority | Review Notes |
| FL-070 | Consolidate flight tests into a release gate | QA + DevOps | 14 | 2026-11-02 12:00:00 | 2026-11-06 12:00:00 | One command/CI gate verifies Flights | Not Started | P0 |  |
| SEC-601 | Security review of redirects, credentials and logs | Security | 10 | 2026-11-02 12:00:00 | 2026-11-06 12:00:00 | No critical flight security issue remains | Not Started | P0 |  |
| PERF-601 | Concurrent provider performance verification | Backend | 10 | 2026-11-02 12:00:00 | 2026-11-06 12:00:00 | Timeouts and partial results meet targets | Not Started | P1 |  |
| QA-601 | End-to-end failure and expiry scenarios | QA | 14 | 2026-11-09 12:00:00 | 2026-11-13 12:00:00 | Empty, stale, timeout and partial cases pass | Not Started | P0 |  |
| DOC-601 | Prepare demo script and provider architecture brief | Product | 10 | 2026-11-09 12:00:00 | 2026-11-13 12:00:00 | Provider-facing evidence package is complete | Not Started | P1 |  |
| LEGAL-601 | Review development, privacy and redirect disclosures | Product + Counsel | 6 | 2026-11-09 12:00:00 | 2026-11-13 12:00:00 | Public preview language is approved | Blocked - Review | P0 |  |
| REL-601 | Product Owner release review and rollback checklist | Product + DevOps | 6 | 2026-11-09 12:00:00 | 2026-11-13 12:00:00 | Release decision and rollback steps are recorded | Not Started | P0 |  |
| SPRINT REVIEW BOX |  |  |  |  |  |  |  |  |  |
| Review Date | 2026-11-13 12:00:00 | Review Time | 2:00–3:30 PM CT | Result Status | Pending | Completion |  | Reviewer | Product Owner |
| Actual Result | Enter the demonstrated sprint outcome |  |  |  |  |  |  |  |  |
| Decision / Follow-up | Enter accepted changes, carry-over items and owner |  |  |  |  |  |  |  |  |
## Sheet: Master Backlog
| Flights Master Backlog |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Editable source of planned work across all six sprints |  |  |  |  |  |  |  |  |  |
| Sprint | ID | Work Item | Owner | Hours | Start | End | Expected Result | Status | Priority |
| Sprint 1 | FL-001 | Make redirect-only behavior the single public Flights path | Product + Frontend | 14 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | Public comparison journey never enters Rovvy checkout | Complete | P0 |
| Sprint 1 | FL-002 | Disable internal checkout entry points and booking CTAs | Frontend | 14 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | No public link reaches travelers, extras, review or payment | Complete | P0 |
| Sprint 1 | FL-003 | Add consistent development-preview disclosure | Product + Frontend | 8 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | Test status is visible before seller selection | Complete | P0 |
| Sprint 1 | FL-004 | Allow guest comparison and provider handoff | Frontend | 10 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | Authentication is not required to compare or redirect | Complete | P0 |
| Sprint 1 | FL-041 | Replace booking language with comparison language | Product | 10 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | All public copy uses Compare providers / Continue to provider | Complete | P0 |
| Sprint 1 | FL-044 | Add provider-owned payment and support disclosure | Product + QA | 8 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | Responsibility is clear beside every future redirect | Complete | P0 |
| Sprint 1 | QA-101 | Regression tests for prohibited checkout paths and copy | QA | 8 | 2026-08-24 12:00:00 | 2026-09-04 12:00:00 | Automated tests prevent aggregator/OTA regression | Complete | P0 |
| Sprint 2 | FL-010 | Enforce provider activation gate | Backend | 14 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | Only configured + enabled + authorized + actionable sellers appear | Not Started | P0 |
| Sprint 2 | FL-011 | Separate registered, configured, enabled and actionable states | Backend | 10 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | Provider directory accurately reports lifecycle state | Not Started | P0 |
| Sprint 2 | FL-012 | Block non-actionable seller prices from selection | Backend + Frontend | 10 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | Unavailable sellers have no Continue action | Not Started | P0 |
| Sprint 2 | FL-013 | Add authorization type and terms-review metadata | Product + Backend | 10 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | Every production provider has auditable authorization metadata | Not Started | P1 |
| Sprint 2 | FL-045 | Separate test and live seller presentation | Frontend | 10 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | Sandbox results cannot visually impersonate live inventory | Not Started | P0 |
| Sprint 2 | FL-071 | Implement redirect-domain allowlist and validation | Security + Backend | 14 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | Unknown, non-HTTPS and malformed redirects are blocked | Not Started | P0 |
| Sprint 2 | QA-201 | Provider failure and partial-result security tests | QA | 8 | 2026-09-07 12:00:00 | 2026-09-18 12:00:00 | One failed provider does not hide successful results | Not Started | P0 |
| Sprint 3 | FL-021 | Expand itinerary fingerprint coverage | Backend | 16 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Codeshare, time-zone, terminal and overnight cases are covered | Not Started | P0 |
| Sprint 3 | FL-022 | Verify exact-match itinerary grouping | Backend | 12 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Same flight from two providers appears once | Not Started | P0 |
| Sprint 3 | FL-023 | Prevent near-match itinerary collisions | Backend + QA | 14 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Different flight numbers/dates/connections never merge | Not Started | P0 |
| Sprint 3 | FL-024 | Normalize currencies while preserving source values | Backend | 12 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Comparison is consistent and auditable | Not Started | P1 |
| Sprint 3 | FL-025 | Define transparent seller ordering | Product + Backend | 10 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Ordering considers price, freshness and disclosure completeness | Not Started | P1 |
| Sprint 3 | FL-073 | Add sanitized provider contract fixtures | QA | 10 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Provider normalizers are repeatably tested | Not Started | P1 |
| Sprint 3 | QA-301 | Expired and duplicate offer regression suite | QA | 6 | 2026-09-21 12:00:00 | 2026-10-02 12:00:00 | Expired offers cannot set the starting price | Not Started | P0 |
| Sprint 4 | FL-033 | Add search freshness and provider coverage summary | Frontend | 10 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | Users understand coverage and last checked state | Not Started | P1 |
| Sprint 4 | FL-040 | Present itinerary with provider count and starting price | Frontend | 14 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | One card communicates the essential decision | Not Started | P0 |
| Sprint 4 | FL-042 | Keep materially weaker alternatives collapsed | Frontend | 8 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | Strong results lead; alternatives remain discoverable | Not Started | P1 |
| Sprint 4 | FL-043 | Explain Rovvy recommendation reasons | Product + Frontend | 10 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | Recommendation logic is understandable | Not Started | P1 |
| Sprint 4 | FL-060 | Design confirmed-flight attachment to Trip Space | Product + Full Stack | 18 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | External booking can be recorded without Rovvy servicing it | Not Started | P1 |
| Sprint 4 | FL-072 | Accessibility and responsive visual regression | QA + Frontend | 12 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | Keyboard, mobile and no-overflow requirements pass | Not Started | P1 |
| Sprint 4 | UX-401 | Usability review with solo and group scenarios | Product | 6 | 2026-10-05 12:00:00 | 2026-10-16 12:00:00 | Review findings and decisions are recorded | Not Started | P1 |
| Sprint 5 | FL-050 | Finalize redirect-only provider adapter template | Backend | 14 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Adapter contract requires valid handoff metadata | Not Started | P0 |
| Sprint 5 | FL-051 | Integrate selected authorized evaluation feed | Backend | 24 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Authorized offers enter the coordinator | Blocked - Access | P1 |
| Sprint 5 | PR-501 | Document provider permission and branding requirements | Product | 8 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Access evidence and obligations are auditable | Blocked - Access | P0 |
| Sprint 5 | SEC-501 | Secure credentials and redact provider errors | Security + Backend | 10 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Secrets never reach client or logs | Not Started | P0 |
| Sprint 5 | QA-501 | Provider contract and redirect tests | QA | 12 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Sanitized responses and safe handoffs pass | Blocked - Access | P0 |
| Sprint 5 | OBS-501 | Provider latency, failure and rate-limit telemetry | Backend | 8 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Evaluation behavior is measurable | Not Started | P1 |
| Sprint 5 | DOC-501 | Provider integration runbook | Product + Engineering | 4 | 2026-10-19 12:00:00 | 2026-10-30 12:00:00 | Next providers can follow a repeatable process | Not Started | P1 |
| Sprint 6 | FL-070 | Consolidate flight tests into a release gate | QA + DevOps | 14 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | One command/CI gate verifies Flights | Not Started | P0 |
| Sprint 6 | SEC-601 | Security review of redirects, credentials and logs | Security | 10 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | No critical flight security issue remains | Not Started | P0 |
| Sprint 6 | PERF-601 | Concurrent provider performance verification | Backend | 10 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | Timeouts and partial results meet targets | Not Started | P1 |
| Sprint 6 | QA-601 | End-to-end failure and expiry scenarios | QA | 14 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | Empty, stale, timeout and partial cases pass | Not Started | P0 |
| Sprint 6 | DOC-601 | Prepare demo script and provider architecture brief | Product | 10 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | Provider-facing evidence package is complete | Not Started | P1 |
| Sprint 6 | LEGAL-601 | Review development, privacy and redirect disclosures | Product + Counsel | 6 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | Public preview language is approved | Blocked - Review | P0 |
| Sprint 6 | REL-601 | Product Owner release review and rollback checklist | Product + DevOps | 6 | 2026-11-02 12:00:00 | 2026-11-13 12:00:00 | Release decision and rollback steps are recorded | Not Started | P0 |