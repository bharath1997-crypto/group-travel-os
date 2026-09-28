#!/usr/bin/env python3
"""
Generate 1,015 worldwide remote map-tap coordinates for geocoding API battery tests.

Points are biased away from national capitals and major metro centers — remote land,
admin regions, deserts, tundra, highlands, and island interiors.

Usage:
    python scripts/generate_geocoding_remote_battery.py
    python scripts/generate_geocoding_remote_battery.py --output tests/fixtures/geocoding_remote_battery.json
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "tests" / "fixtures" / "geocoding_remote_battery.json"
TARGET_COUNT = 1015
MIN_CAPITAL_KM = 75.0

# (label, min_lat, max_lat, min_lng, max_lng, sample_count)
REMOTE_REGIONS: tuple[tuple[str, float, float, float, float, int], ...] = (
    ("Canadian Arctic", 62.0, 74.0, -120.0, -85.0, 35),
    ("Greenland", 60.0, 76.0, -52.0, -22.0, 30),
    ("Alaska interior", 58.0, 68.0, -160.0, -140.0, 35),
    ("Yukon wilderness", 60.0, 66.0, -138.0, -128.0, 18),
    ("Labrador remote", 52.0, 58.0, -64.0, -57.0, 15),
    ("US Great Basin", 37.0, 42.0, -118.0, -112.0, 22),
    ("US Montana badlands", 46.0, 49.0, -108.0, -104.0, 18),
    ("Sonoran desert", 29.0, 32.0, -114.0, -109.0, 18),
    ("Amazon remote", -6.0, 2.0, -68.0, -58.0, 25),
    ("Patagonia", -52.0, -44.0, -73.0, -68.0, 28),
    ("Altiplano", -18.0, -14.0, -68.5, -66.0, 20),
    ("Brazilian cerrado", -16.0, -10.0, -48.0, -44.0, 18),
    ("Sahara west", 20.0, 28.0, -12.0, 0.0, 22),
    ("Sahara central", 18.0, 26.0, 2.0, 14.0, 22),
    ("Sahel", 12.0, 18.0, -5.0, 12.0, 18),
    ("Congo basin", -2.0, 4.0, 18.0, 26.0, 18),
    ("Kalahari", -25.0, -20.0, 20.0, 26.0, 18),
    ("Horn of Africa interior", 5.0, 11.0, 42.0, 48.0, 18),
    ("Ethiopian highlands", 7.0, 12.0, 37.0, 40.0, 15),
    ("Madagascar interior", -22.0, -16.0, 44.0, 48.0, 15),
    ("Empty Quarter", 18.0, 23.0, 48.0, 56.0, 22),
    ("Iranian plateau", 30.0, 36.0, 52.0, 58.0, 18),
    ("Central Asian steppe", 44.0, 50.0, 62.0, 72.0, 22),
    ("Siberia taiga", 58.0, 66.0, 88.0, 110.0, 32),
    ("Russian Far East", 50.0, 58.0, 128.0, 142.0, 22),
    ("Mongolia Gobi", 42.0, 46.0, 100.0, 108.0, 22),
    ("Tibet plateau", 30.0, 34.0, 86.0, 92.0, 18),
    ("Western China desert", 38.0, 42.0, 82.0, 90.0, 20),
    ("Australian outback", -28.0, -20.0, 127.0, 138.0, 30),
    ("Gibson desert", -26.0, -22.0, 124.0, 128.0, 15),
    ("NZ South Island alps", -44.5, -42.5, 169.0, 171.5, 12),
    ("PNG highlands", -6.5, -4.5, 144.0, 147.0, 12),
    ("Borneo interior", 0.0, 3.0, 114.0, 117.0, 12),
    ("Lapland", 66.0, 69.0, 24.0, 28.0, 15),
    ("Scottish Highlands", 57.0, 58.5, -5.5, -3.5, 12),
    ("Anatolian plateau", 38.0, 40.0, 33.0, 36.0, 12),
    ("Rajasthan desert", 26.0, 28.5, 70.0, 73.0, 12),
    ("NE India hills", 25.0, 27.5, 93.0, 96.0, 12),
    ("Hokkaido interior", 43.0, 44.5, 142.5, 144.5, 12),
    ("Taiwan central mountains", 23.5, 24.5, 121.0, 121.8, 10),
    ("Kamchatka", 53.0, 57.0, 156.0, 162.0, 12),
    ("Hudson Bay lowlands", 56.0, 60.0, -92.0, -82.0, 15),
    ("Antarctica coast", -72.0, -65.0, -70.0, 30.0, 18),
    ("Antarctica interior", -82.0, -75.0, -100.0, 40.0, 15),
    ("Svalbard", 76.5, 79.5, 12.0, 22.0, 12),
    ("Iceland interior", 64.0, 65.5, -19.0, -16.0, 10),
    ("Faroe Islands", 61.4, 62.2, -7.5, -6.3, 8),
    ("Pacific atolls (land)", -8.0, 8.0, 170.0, -160.0, 20),
    ("Mediterranean islands interior", 35.0, 37.5, 24.0, 26.0, 10),
)

ANCHOR_POINTS: tuple[tuple[str, float, float, str], ...] = (
    ("Greenland ice sheet (user pin)", 65.43711, -44.69036, "Greenland"),
    ("Kitikmeot Region Nunavut (user pin)", 66.01268, -105.93853, "Canada"),
    ("Vinson Massif Antarctica", -78.5255, -85.6171, "Antarctica"),
    ("Sahara erg near Timbuktu", 16.766588, -3.002561, "Mali"),
    ("Siberia Lena delta", 72.4, 126.7, "Russia"),
    ("Outback near Uluru offset", -25.8, 131.2, "Australia"),
    ("Patagonia ice field", -49.2, -73.5, "Chile"),
    ("Mongolia steppe remote", 45.2, 103.8, "Mongolia"),
    ("Namib desert interior", -24.5, 15.3, "Namibia"),
    ("Yukon Peel watershed", 64.8, -136.2, "Canada"),
    ("Alaska Brooks Range", 68.5, -150.2, "United States"),
    ("Bolivian Salar edge", -20.2, -67.5, "Bolivia"),
    ("Tibet Changtang", 33.5, 88.0, "China"),
    ("Kazakh steppe", 47.5, 67.0, "Kazakhstan"),
    ("Myanmar Shan hills", 21.5, 98.2, "Myanmar"),
)

MAJOR_CITIES: tuple[tuple[float, float], ...] = (
    (38.9072, -77.0369),
    (51.5074, -0.1278),
    (48.8566, 2.3522),
    (52.5200, 13.4050),
    (55.7558, 37.6173),
    (39.9042, 116.4074),
    (35.6762, 139.6503),
    (28.6139, 77.2090),
    (19.0760, 72.8777),
    (1.3521, 103.8198),
    (37.5665, 126.9780),
    (25.2048, 55.2708),
    (30.0444, 31.2357),
    (-33.8688, 151.2093),
    (41.8781, -87.6298),
    (40.7128, -74.0060),
    (34.0522, -118.2437),
    (49.2827, -123.1207),
    (45.4215, -75.6972),
    (19.4326, -99.1332),
    (-23.5505, -46.6333),
    (-34.6037, -58.3816),
    (-33.4489, -70.6693),
    (59.3293, 18.0686),
    (52.3676, 4.9041),
    (41.9028, 12.4964),
    (40.4168, -3.7038),
    (50.8503, 4.3517),
    (47.4979, 19.0402),
    (44.4268, 26.1025),
    (41.0082, 28.9784),
    (33.8938, 35.5018),
    (31.7683, 35.2137),
    (24.7136, 46.6753),
    (33.3152, 44.3661),
    (35.6892, 51.3890),
    (41.7151, 44.8271),
    (39.9334, 32.8597),
    (50.4501, 30.5234),
    (52.2297, 21.0122),
    (50.0755, 14.4378),
    (48.2082, 16.3738),
    (59.9139, 10.7522),
    (55.6761, 12.5683),
    (60.1699, 24.9384),
    (64.1466, -21.9426),
    (-36.8485, 174.7633),
    (14.5995, 120.9842),
    (13.7563, 100.5018),
    (-6.2088, 106.8456),
    (3.1390, 101.6869),
    (22.3193, 114.1694),
    (31.2304, 121.4737),
    (39.3434, 117.3616),
    (23.1291, 113.2644),
    (30.5728, 104.0668),
    (29.5630, 106.5516),
    (43.8256, 87.6168),
    (36.0611, 103.8343),
    (34.3416, 108.9398),
    (45.8038, 126.5350),
    (38.0428, 114.5149),
    (26.0745, 119.2965),
    (22.5431, 114.0579),
    (-1.2921, 36.8219),
    (9.0579, 7.4951),
    (-26.2041, 28.0473),
    (-15.3875, 28.3228),
    (-4.4419, 15.2663),
    (6.5244, 3.3792),
    (5.6037, -0.1870),
    (-17.8252, 31.0335),
    (-29.8587, 31.0218),
    (-25.7479, 28.2293),
    (-33.9249, 18.4241),
    (-12.0464, -77.0428),
    (-0.1807, -78.4678),
    (4.7110, -74.0721),
    (10.4806, -66.9036),
    (18.4861, -69.9312),
    (23.1136, -82.3666),
    (9.9281, -84.0907),
    (8.9824, -79.5199),
    (14.6349, -90.5069),
    (13.6929, -89.2182),
    (-16.4897, -68.1193),
    (-12.0464, -77.0428),
    (-34.9011, -56.1645),
    (-0.2299, -78.5249),
    (-2.1709, -79.9224),
    (64.1355, -21.8954),
    (55.9533, -3.1883),
    (53.3498, -6.2603),
    (43.2965, 5.3698),
    (43.6108, 3.8767),
    (45.7640, 4.8357),
    (43.6047, 1.4442),
    (47.2184, -1.5536),
    (44.8378, -0.5792),
    (43.7102, 7.2620),
    (41.3851, 2.1734),
    (37.9838, 23.7275),
    (42.6977, 23.3219),
    (44.8176, 20.4633),
    (45.8150, 15.9819),
    (46.0569, 14.5058),
    (48.1486, 17.1077),
    (50.0875, 14.4213),
    (52.4064, 16.9252),
    (54.3520, 18.6466),
    (53.4285, 14.5528),
    (51.7592, 19.4560),
    (50.0647, 19.9450),
    (53.9006, 27.5590),
    (56.9496, 24.1052),
    (54.6872, 25.2797),
    (59.4370, 24.7536),
    (60.1699, 24.9384),
    (61.4978, 23.7610),
    (65.0121, 25.4651),
    (62.2426, 25.7473),
    (47.0105, 28.8638),
    (46.7712, 23.6236),
    (44.4268, 26.1025),
    (42.6977, 23.3219),
    (42.4304, 19.2594),
    (41.3275, 19.8187),
    (43.8563, 18.4131),
    (45.8150, 15.9819),
)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _far_from_capitals(lat: float, lng: float) -> bool:
    return all(_haversine_km(lat, lng, c_lat, c_lng) >= MIN_CAPITAL_KM for c_lat, c_lng in MAJOR_CITIES)


def _round_coord(value: float) -> float:
    return round(value, 5)


def generate_cases() -> list[dict[str, object]]:
    random.seed(42)
    cases: list[dict[str, object]] = []
    seen: set[tuple[float, float]] = set()

    def add_case(
        case_id: str,
        lat: float,
        lng: float,
        region: str,
        *,
        anchor: bool = False,
    ) -> None:
        lat_r = _round_coord(lat)
        lng_r = _round_coord(lng)
        key = (lat_r, lng_r)
        if key in seen:
            return
        if not anchor and not _far_from_capitals(lat_r, lng_r):
            return
        seen.add(key)
        cases.append(
            {
                "id": case_id,
                "lat": lat_r,
                "lng": lng_r,
                "region": region,
                "anchor": anchor,
            }
        )

    for idx, (label, lat, lng, region_hint) in enumerate(ANCHOR_POINTS, start=1):
        add_case(f"anchor-{idx:03d}", lat, lng, region_hint, anchor=True)

    for region_idx, (label, min_lat, max_lat, min_lng, max_lng, count) in enumerate(REMOTE_REGIONS, start=1):
        attempts = 0
        added = 0
        while added < count and attempts < count * 40:
            attempts += 1
            lat = random.uniform(min_lat, max_lat)
            lng = random.uniform(min_lng, max_lng)
            before = len(cases)
            add_case(f"remote-{region_idx:02d}-{added + 1:03d}", lat, lng, label)
            if len(cases) > before:
                added += 1

    # Top up to exactly TARGET_COUNT with global sparse grid if any region under-filled.
    grid_lat = -60.0
    grid_id = 0
    while len(cases) < TARGET_COUNT:
        for lng in range(-180, 180, 17):
            if len(cases) >= TARGET_COUNT:
                break
            lat = grid_lat
            grid_id += 1
            add_case(f"grid-{grid_id:04d}", lat, float(lng), "Global sparse grid")
        grid_lat += 11.3
        if grid_lat > 72:
            grid_lat = -55

    return cases[:TARGET_COUNT]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate geocoding remote battery fixture")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    cases = generate_cases()
    if len(cases) != TARGET_COUNT:
        raise SystemExit(f"Expected {TARGET_COUNT} cases, generated {len(cases)}")

    payload = {
        "version": 1,
        "description": "Worldwide remote map-tap coordinates for /api/v1/geocoding/reverse battery tests",
        "count": len(cases),
        "cases": cases,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(cases)} cases to {args.output}")


if __name__ == "__main__":
    main()
