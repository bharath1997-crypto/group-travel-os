"""Read-only: match checked Gemini venues (status ok) to Overture places in `places`.

Matching only. Writes nothing to the DB (read-only transaction) and takes no
coordinates from Gemini or any external geocoder: the coordinates in the
output are the Overture place's own point. Usage:

    python -m scaper.venue_overture_match --reports data/*.report.csv --out data/venue_overture_matches.csv
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
import sys
from urllib.parse import urlparse

from sqlalchemy import create_engine, text

from scaper.dedup import norm_postcode, same_venue_name

# Ticketing chains / shared calendars that must never become a venue's own feed.
CHAIN_HOSTS = ("houseofblues.com", "livenation.com", "stgpresents.org", "promowestlive.com",
               "313presents.com", "jamusa.com", "portland5.com", "ticketmaster.com")
CHAIN_NAMES = re.compile(r"house of blues|live nation|\(stg\)", re.I)


def is_chain(row: dict) -> bool:
    host = (urlparse(row.get("calendar_url") or "").hostname or "").lower()
    if any(host == h or host.endswith("." + h) for h in CHAIN_HOSTS):
        return True
    return bool(CHAIN_NAMES.search(row.get("venue_name") or ""))


def _clean(name: str) -> str:
    return re.sub(r"\s*\(.*?\)", "", name).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reports", nargs="+", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    files = sorted({f for pat in args.reports for f in glob.glob(pat)})
    rows = []
    for f in files:
        with open(f, encoding="utf-8", newline="") as fh:
            ok = [r for r in csv.DictReader(fh) if r["status"] == "ok"]
        # The checker report drops postcode/street: join them back from the source CSV.
        src = f.replace(".report.csv", ".csv")
        meta = {}
        if os.path.exists(src):
            with open(src, encoding="utf-8", newline="") as sh:
                meta = {(m["venue_name"], m["city"]): m for m in csv.DictReader(sh)}
        for r in ok:
            m = meta.get((r["venue_name"], r["city"]), {})
            r["postcode"] = m.get("postcode", "")
            r["street_address"] = m.get("street_address", "")
        rows += ok

    engine = create_engine(os.environ["DATABASE_URL"])
    out = []
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        conn.execute(text("SET pg_trgm.similarity_threshold = 0.45"))
        for r in rows:
            res = dict(r, chain="yes" if is_chain(r) else "", match_status="", place_id="",
                       gers_id="", place_name="", lat="", lng="", similarity="", dist_note="")
            name = _clean(r["venue_name"])
            cands = conn.execute(text("""
                SELECT id::text AS id, gers_id, name, similarity(name, :n) AS sim,
                       ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng,
                       address->>'postcode' AS postcode, city_slug
                FROM places
                WHERE gers_id IS NOT NULL AND name % :n
                ORDER BY sim DESC LIMIT 40
            """), {"n": name}).mappings().all()
            zip5 = norm_postcode(r.get("postcode") or "")[:5]
            city = re.sub(r"[^a-z0-9]+", "", (r.get("city") or "").lower())
            cands = [c for c in cands
                     if (zip5 and norm_postcode(c["postcode"] or "")[:5] == zip5)
                     or (city and city in re.sub(r"[^a-z0-9]+", "", (c["city_slug"] or "").lower()))]
            best = None
            for c in cands:
                same_zip = norm_postcode(c["postcode"] or "")[:5] == norm_postcode(r.get("postcode") or "")[:5]
                if (same_zip and c["sim"] >= 0.5) or c["sim"] >= 0.75 or same_venue_name(name, c["name"], None):
                    best = c
                    break
            if best:
                res.update(match_status="matched", place_id=best["id"], gers_id=best["gers_id"],
                           place_name=best["name"], lat=f"{best['lat']:.6f}", lng=f"{best['lng']:.6f}",
                           similarity=f"{best['sim']:.2f}")
            else:
                res["match_status"] = "no_match"
            out.append(res)

    fields = list(out[0].keys()) if out else []
    with open(args.out, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(out)
    m = sum(1 for o in out if o["match_status"] == "matched")
    ch = sum(1 for o in out if o["chain"])
    print(f"{len(out)} ok rows from {len(files)} reports: {m} matched, {len(out) - m} no match, {ch} flagged chain")
    return 0


if __name__ == "__main__":
    sys.exit(main())
