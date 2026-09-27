#!/usr/bin/env python3
"""
Step 3 — verify filtered extract against §3 thresholds.

Runs four checks on data/filtered.csv and prints a summary report.
Does not change schema or thresholds — report only.

Usage:
    python scripts/03_verify.py
    python scripts/03_verify.py --input data/filtered.csv
"""
from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "filtered.csv"

# §3 action thresholds (report hints only — no auto-changes)
THRESHOLD_SOCIALS_PCT = 20.0
THRESHOLD_INSTAGRAM_PCT = 40.0
THRESHOLD_MIN_ROWS = 4_000
THRESHOLD_PHONES_PCT = 50.0
TOP_CATEGORY_ROWS = 25


def _pct_with_socials(con: duckdb.DuckDBPyConnection, path: str) -> float:
    row = con.execute(
        """
        SELECT
          count(*) FILTER (
            WHERE socials IS NOT NULL AND len(socials) > 0
          ) * 100.0 / count(*) AS pct
        FROM read_csv_auto(?)
        """,
        [path],
    ).fetchone()
    return float(row[0] if row and row[0] is not None else 0.0)


def _pct_with_instagram(con: duckdb.DuckDBPyConnection, path: str) -> tuple[int, float]:
    row = con.execute(
        """
        SELECT
          count(*) FILTER (
            WHERE instagram IS NOT NULL AND trim(instagram) <> ''
          ) AS with_ig,
          count(*) FILTER (
            WHERE instagram IS NOT NULL AND trim(instagram) <> ''
          ) * 100.0 / count(*) AS pct
        FROM read_csv_auto(?)
        """,
        [path],
    ).fetchone()
    return int(row[0] or 0), float(row[1] if row and row[1] is not None else 0.0)


def _pct_with_phones(con: duckdb.DuckDBPyConnection, path: str) -> float:
    row = con.execute(
        """
        SELECT
          count(*) FILTER (
            WHERE phones IS NOT NULL AND len(phones) > 0
          ) * 100.0 / count(*) AS pct
        FROM read_csv_auto(?)
        """,
        [path],
    ).fetchone()
    return float(row[0] if row and row[0] is not None else 0.0)


def _row_count(con: duckdb.DuckDBPyConnection, path: str) -> int:
    return int(con.execute("SELECT count(*) FROM read_csv_auto(?)", [path]).fetchone()[0])


def _confidence_bucket_expr() -> str:
    """Postgres width_bucket(confidence, 0, 1, 10) equivalent in DuckDB."""
    return """
      CASE
        WHEN confidence < 0 THEN 0
        WHEN confidence >= 1 THEN 11
        ELSE least(10, floor(confidence * 10)::INTEGER + 1)
      END
    """


def _confidence_buckets(con: duckdb.DuckDBPyConnection, path: str) -> list[tuple[int, int]]:
    bucket_expr = _confidence_bucket_expr()
    rows = con.execute(
        f"""
        SELECT
          {bucket_expr} AS bucket,
          count(*) AS n
        FROM read_csv_auto(?)
        WHERE confidence IS NOT NULL
        GROUP BY 1
        ORDER BY 1
        """,
        [path],
    ).fetchall()
    return [(int(bucket), int(n)) for bucket, n in rows]


def _bucket_range_label(bucket: int) -> str:
    if bucket <= 0:
        return "< 0.0"
    if bucket >= 11:
        return "> 1.0"
    low = (bucket - 1) * 0.1
    high = bucket * 0.1
    return f"{low:.1f}-{high:.1f}"


def _status_socials(pct: float) -> str:
    return "ok" if pct >= THRESHOLD_SOCIALS_PCT else "below threshold"


def _status_rows(n: int) -> str:
    return "ok" if n >= THRESHOLD_MIN_ROWS else "below threshold"


def _status_phones(pct: float) -> str:
    return "ok" if pct >= THRESHOLD_PHONES_PCT else "below threshold"


def _status_instagram(pct: float) -> str:
    return "ok" if pct >= THRESHOLD_INSTAGRAM_PCT else "below threshold"


def _category_breakdown(
    con: duckdb.DuckDBPyConnection, path: str, limit: int
) -> list[tuple[str, int, float]]:
    rows = con.execute(
        """
        SELECT
          basic_category,
          count(*) AS n,
          round(count(*) * 100.0 / sum(count(*)) OVER (), 1) AS pct
        FROM read_csv_auto(?)
        GROUP BY 1
        ORDER BY n DESC
        LIMIT ?
        """,
        [path, limit],
    ).fetchall()
    return [(str(cat), int(n), float(pct)) for cat, n, pct in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify filtered Overture extract.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    args = parser.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"Input not found: {args.input}")

    path = str(args.input.resolve())
    con = duckdb.connect()

    socials_pct = _pct_with_socials(con, path)
    ig_count, ig_pct = _pct_with_instagram(con, path)
    phones_pct = _pct_with_phones(con, path)
    rows = _row_count(con, path)
    buckets = _confidence_buckets(con, path)
    categories = _category_breakdown(con, path, TOP_CATEGORY_ROWS)

    print(f"input={args.input}")
    print()
    print("=" * 72)
    print("ROVVY PLACES VERIFY - Section 3 checks (report only)")
    print("=" * 72)
    print()
    print(f"{'Check':<28} {'Value':>14} {'Threshold':>16} {'Status':>12}")
    print("-" * 72)
    print(
        f"{'Socials fill %':<28} {socials_pct:>13.1f}% "
        f"{f'>= {THRESHOLD_SOCIALS_PCT:.0f}%':>16} {_status_socials(socials_pct):>12}"
    )
    print(
        f"{'Instagram fill %':<28} {ig_pct:>13.1f}% "
        f"{f'>= {THRESHOLD_INSTAGRAM_PCT:.0f}%':>16} {_status_instagram(ig_pct):>12}"
    )
    print(f"{'Instagram rows':<28} {ig_count:>14,}")
    print(
        f"{'Final row count':<28} {rows:>14,} "
        f"{f'>= {THRESHOLD_MIN_ROWS:,}':>16} {_status_rows(rows):>12}"
    )
    print(
        f"{'Phones fill %':<28} {phones_pct:>13.1f}% "
        f"{f'>= {THRESHOLD_PHONES_PCT:.0f}%':>16} {_status_phones(phones_pct):>12}"
    )
    print()
    print("Confidence distribution (10 buckets, filtered rows)")
    print(f"{'Bucket':<8} {'Range':<14} {'Count':>10} {'Bar'}")
    print("-" * 72)
    max_n = max((n for _, n in buckets), default=1)
    for bucket, n in buckets:
        bar_len = int(40 * n / max_n) if max_n else 0
        bar = "#" * bar_len
        print(
            f"{bucket:>4}     {_bucket_range_label(bucket):<14} {n:>10,}  {bar}"
        )
    print()
    print(f"Category breakdown (top {TOP_CATEGORY_ROWS} by row count)")
    print(f"{'Category':<36} {'Count':>10} {'Share':>8}")
    print("-" * 72)
    for cat, n, pct in categories:
        print(f"{cat:<36} {n:>10,} {pct:>7.1f}%")
    print()
    print("Confidence floor: keep 0.5 (rank in layer 2, do not gate harder).")
    print("Load step: clamp confidence with least(confidence, 1.0).")
    print("No schema or cutoff changes applied - review and decide next steps.")


if __name__ == "__main__":
    main()
