"""One-off: build frontend/lib/countries.ts from datasets/country-codes CSV."""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Prefer committed copy; fallback to path used during dev
CSV_CANDIDATES = [
    ROOT / "frontend" / "data" / "country-codes.csv",
    Path(
        r"C:\Users\bhara\.cursor\projects\d-Practice-group-travel-os-group-travel-os"
        r"\agent-tools\2e71de9c-e9f1-4188-bd3b-b330561c47b2.txt"
    ),
]

src = next((p for p in CSV_CANDIDATES if p.is_file()), None)
if not src:
    raise SystemExit("No country-codes CSV found. Place frontend/data/country-codes.csv")

out_path = ROOT / "frontend" / "lib" / "countries.ts"

rows: list[dict[str, str]] = []
with src.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        dial_raw = (row.get("Dial") or "").strip()
        iso2 = (row.get("ISO3166-1-Alpha-2") or "").strip()
        name = (row.get("official_name_en") or "").strip()
        if not dial_raw or not iso2 or not name:
            continue
        if "-" in dial_raw:
            dial = "".join(dial_raw.split("-"))
        else:
            dial = dial_raw
        if not dial.isdigit():
            continue
        rows.append({"name": name, "iso2": iso2, "dial": dial})

rows.sort(key=lambda x: x["name"])

lines: list[str] = [
    "/** Built from datasets/country-codes CSV (Dial + ISO3166-1-Alpha-2 + official_name_en). */",
    "export type CountryOption = {",
    "  /** English short official name */",
    "  name: string;",
    "  /** ISO 3166-1 alpha-2 */",
    "  iso2: string;",
    "  /** Country calling code digits (no +), e.g. 1, 91, 1684 */",
    "  dial: string;",
    "};",
    "",
    "export const COUNTRIES: CountryOption[] = [",
]
for r in rows:
    nm = r["name"].replace("\\", "\\\\").replace('"', '\\"')
    lines.append(f'  {{ name: "{nm}", iso2: "{r["iso2"]}", dial: "{r["dial"]}" }},')
lines.append("];")
lines.append("")
lines.append("export function dialDisplay(dial: string): string {")
lines.append('  return dial ? `+${dial}` : "";')
lines.append("}")
lines.append("")

out_path.write_text("\n".join(lines), encoding="utf-8")
print("wrote", out_path, "entries", len(rows))
