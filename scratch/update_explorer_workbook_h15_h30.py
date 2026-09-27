from __future__ import annotations

import zipfile
from pathlib import Path

from openpyxl import load_workbook

path = Path(r"Scram Book/Explorer Tab/Rovvy_Explorer_Scrum_Book.xlsx")
wb = load_workbook(path)
ws = wb.active

h15 = (
    "2026-09-24: search_events_extended + GET /explore/events defensive filter; "
    "editorial isolated on /seasonal-events-ai; hub fetchExploreHub strips generated rows before mapping/counts. "
    "Predicate: ai_fallback, ai_*, exact ai, editorial markers, ai-ev-/editorial- IDs; does not match the substring "
    "'ai' in ticketmaster. Explore Vitest fixtures use live dateRangeForWhen (explore-test-date-fixtures.ts; calendar regression). "
    "pytest tests/test_explore_events_endpoint.py: 16 passed. Explore Vitest: 86 passed (14 files); tsc --noEmit: 0 errors."
)
h30 = (
    "2026-09-24: Verified inventory totals and pages exclude generated cache rows at service layer; "
    "hub fetch still filters before slot mapping. Date-dependent Explore tests (hub counts, v6 map, G07 fetch) "
    "derive event dates from dateRangeForWhen(when).dateFrom + offsets; no stale fixed clock. "
    "pytest test_explore_events_endpoint.py: 16 passed. Explore Vitest: 86 passed (14 files); tsc --noEmit: 0 errors."
)

assert ws.cell(15, 4).value == "Complete in code", ws.cell(15, 4).value
assert ws.cell(30, 4).value == "Complete in code", ws.cell(30, 4).value
ws.cell(15, 8).value = h15
ws.cell(30, 8).value = h30
wb.save(path)

with zipfile.ZipFile(path) as z:
    xml = z.read("xl/worksheets/sheet1.xml").decode("utf-8")

print("D15:", ws.cell(15, 4).value)
print("H15:", ws.cell(15, 8).value)
print("D30:", ws.cell(30, 4).value)
print("H30:", ws.cell(30, 8).value)
print("conditionalFormatting:", xml.count("conditionalFormatting"))
print("dataValidation:", xml.count("<dataValidation"))
