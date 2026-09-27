#!/usr/bin/env python3
"""
Run live /api/v1/geocoding/reverse against all 1,015 remote battery cases.

Respects Nominatim rate limits (~1 req/s). Writes JSON + Markdown summary.

Usage:
    python scripts/run_geocoding_battery_report.py
    python scripts/run_geocoding_battery_report.py --limit 50
    python scripts/run_geocoding_battery_report.py --resume
"""
from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "geocoding_remote_battery.json"
REPORT_DIR = ROOT / "tests" / "reports"
DEFAULT_BASE_URL = "http://127.0.0.1:8000/api/v1"
REQUEST_INTERVAL_SECONDS = 1.05


def _load_cases(limit: int | None = None) -> list[dict]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    cases = payload["cases"]
    if limit is not None:
        return cases[:limit]
    return cases


def _load_partial_results(path: Path) -> dict[str, dict]:
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {row["id"]: row for row in data.get("results", [])}


async def _reverse_one(
    client: httpx.AsyncClient,
    base_url: str,
    case: dict,
) -> dict:
    started = time.perf_counter()
    try:
        response = await client.get(
            f"{base_url}/geocoding/reverse",
            params={"lat": case["lat"], "lng": case["lng"]},
            timeout=30.0,
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        if response.status_code != 200:
            return {
                **case,
                "ok": False,
                "http_status": response.status_code,
                "error": response.text[:200],
                "elapsed_ms": elapsed_ms,
            }
        body = response.json()
        if not body:
            return {
                **case,
                "ok": False,
                "http_status": 200,
                "error": "empty_body",
                "elapsed_ms": elapsed_ms,
            }
        address = body.get("address") or {}
        return {
            **case,
            "ok": True,
            "http_status": 200,
            "name": body.get("name"),
            "display_name": body.get("display_name"),
            "country": body.get("country") or address.get("country"),
            "state": body.get("state") or address.get("state"),
            "city": body.get("city"),
            "place_key": body.get("placeKey"),
            "osm_type": body.get("osm_type"),
            "osm_id": body.get("osm_id"),
            "elapsed_ms": elapsed_ms,
        }
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return {
            **case,
            "ok": False,
            "http_status": None,
            "error": str(exc)[:200],
            "elapsed_ms": elapsed_ms,
        }


async def run_battery(
    *,
    base_url: str,
    limit: int | None,
    resume: bool,
    interval: float,
) -> dict:
    cases = _load_cases(limit)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    json_path = REPORT_DIR / f"geocoding_battery_{stamp}.json"
    md_path = REPORT_DIR / f"geocoding_battery_{stamp}.md"

    existing = _load_partial_results(json_path) if resume else {}
    results: list[dict] = []

    async with httpx.AsyncClient() as client:
        for idx, case in enumerate(cases, start=1):
            if resume and case["id"] in existing:
                results.append(existing[case["id"]])
                continue

            row = await _reverse_one(client, base_url, case)
            results.append(row)

            if idx % 25 == 0 or idx == len(cases):
                _write_outputs(json_path, md_path, results, base_url, limit)
                ok = sum(1 for r in results if r.get("ok"))
                print(f"[{idx}/{len(cases)}] ok={ok} fail={len(results) - ok}")

            if idx < len(cases):
                await asyncio.sleep(interval)

    summary = _summarize(results)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "total": len(results),
        "summary": summary,
        "results": results,
    }
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    md_path.write_text(_markdown_report(payload), encoding="utf-8")
    return payload


def _summarize(results: list[dict]) -> dict:
    ok_rows = [r for r in results if r.get("ok")]
    fail_rows = [r for r in results if not r.get("ok")]
    with_country = sum(1 for r in ok_rows if r.get("country"))
    with_state = sum(1 for r in ok_rows if r.get("state"))
    with_city = sum(1 for r in ok_rows if r.get("city"))
    latencies = [r["elapsed_ms"] for r in results if r.get("elapsed_ms") is not None]
    avg_ms = int(sum(latencies) / len(latencies)) if latencies else 0

    by_region: dict[str, dict[str, int]] = {}
    for row in results:
        region = str(row.get("region") or "unknown")
        bucket = by_region.setdefault(region, {"ok": 0, "fail": 0})
        bucket["ok" if row.get("ok") else "fail"] += 1

    return {
        "success": len(ok_rows),
        "failed": len(fail_rows),
        "success_rate_pct": round(100.0 * len(ok_rows) / max(len(results), 1), 2),
        "with_country": with_country,
        "with_state": with_state,
        "with_city": with_city,
        "avg_elapsed_ms": avg_ms,
        "by_region": by_region,
        "sample_failures": fail_rows[:15],
        "sample_successes": ok_rows[:15],
    }


def _write_outputs(json_path: Path, md_path: Path, results: list[dict], base_url: str, limit: int | None) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "limit": limit,
        "total": len(results),
        "summary": _summarize(results),
        "results": results,
    }
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    md_path.write_text(_markdown_report(payload), encoding="utf-8")


def _markdown_report(payload: dict) -> str:
    s = payload["summary"]
    lines = [
        "# Geocoding remote battery report",
        "",
        f"- Generated: {payload.get('generated_at')}",
        f"- Base URL: {payload.get('base_url')}",
        f"- Total cases: {payload.get('total')}",
        f"- Success: **{s['success']}** / {payload.get('total')} ({s['success_rate_pct']}%)",
        f"- Failed: **{s['failed']}**",
        f"- With country: {s['with_country']}",
        f"- With state/province: {s['with_state']}",
        f"- With city: {s['with_city']}",
        f"- Avg latency: {s['avg_elapsed_ms']} ms",
        "",
        "## Failures (first 15)",
        "",
    ]
    for row in s.get("sample_failures", []):
        lines.append(
            f"- `{row['id']}` ({row['lat']}, {row['lng']}) — {row.get('region')}: "
            f"{row.get('error') or row.get('http_status')}"
        )
    lines.extend(["", "## Successes (first 15)", ""])
    for row in s.get("sample_successes", []):
        lines.append(
            f"- `{row['id']}` ({row['lat']}, {row['lng']}) → "
            f"**{row.get('name')}**, {row.get('state') or '—'}, {row.get('country') or '—'}"
        )
    lines.extend(["", "## By region", ""])
    for region, counts in sorted(s.get("by_region", {}).items(), key=lambda x: x[0].lower()):
        total = counts["ok"] + counts["fail"]
        rate = round(100.0 * counts["ok"] / max(total, 1), 1)
        lines.append(f"- {region}: {counts['ok']}/{total} ok ({rate}%)")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run geocoding reverse API battery")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--interval", type=float, default=REQUEST_INTERVAL_SECONDS)
    args = parser.parse_args()

    payload = asyncio.run(
        run_battery(
            base_url=args.base_url.rstrip("/"),
            limit=args.limit,
            resume=args.resume,
            interval=args.interval,
        )
    )
    s = payload["summary"]
    print(
        f"Done: {s['success']}/{payload['total']} ok ({s['success_rate_pct']}%), "
        f"report in tests/reports/"
    )


if __name__ == "__main__":
    main()
