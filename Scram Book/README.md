# Rovvy Scram Book

This folder is Rovvy's authoritative product planning, sprint, decision, and verified-activity record. The existing folder name **Scram Book** is intentional and must be preserved.

## Required workflow

1. Before starting work, identify the affected product area and read its current workbook, report, decision log, and acceptance criteria.
2. Use those records as context; do not duplicate or contradict an existing decision without documenting the change and its reason.
3. Complete and verify the requested work in the project.
4. Update the matching Scram Book artifact with:
   - date and task context;
   - sprint and goals addressed;
   - actual result and files/components affected;
   - tests, visual QA, or other verification performed;
   - provider/data environment when relevant (mock, sandbox, test, or live);
   - unresolved risks, decisions, dependencies, and next action.
5. Never mark an item complete or record a test as passing without evidence.

## Product-area routing

- `Travel Tab`: all Travel-unit planning and implementation records, including Flights, Hotels, Routes, Buses, provider integrations, redirect flows, and group-travel attachment behavior.
- Create another clearly named product-area folder only when no existing folder is appropriate.

## Travel and Flights references

Agents working on Flights must review these files when present:

- `Travel Tab\Rovvy_Travel_Flights_Scrum_Plan.xlsx`
- `Travel Tab\Rovvy_Flights_Detailed_Product_Report.docx`

The report defines the current Flights product boundary: Rovvy compares authorized offers and redirects the traveler to the chosen external provider; it must not represent sandbox/test inventory as a live bookable offer.

## File hygiene

- Keep one authoritative artifact per purpose and update it instead of creating copies such as `final-v2`, `new`, or `latest`.
- Keep temporary exports, render previews, caches, and scratch files outside the Scram Book.
- Preserve Rovvy terminology, brand identity, and verified status language across all records.
