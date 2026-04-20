"""
Travello Fixed Seeder
Run: python seed_full.py
"""

import asyncio
import httpx
from datetime import datetime, timedelta

BASE_URL = "https://group-travel-os-api-704551807369.asia-south1.run.app/api/v1"

EMAIL = "bharath@travello.app"
PASSWORD = "Test@1234"


def extract_access_token(login_data: dict) -> str | None:
    """
    Login returns RegisterResponse: { user, token: { access_token, ... } }.
    Some APIs use a flat access_token string instead.
    """
    if isinstance(login_data.get("access_token"), str):
        return login_data["access_token"]
    raw = login_data.get("token")
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        inner = raw.get("access_token") or raw.get("token")
        if isinstance(inner, str):
            return inner
    data = login_data.get("data")
    if isinstance(data, dict):
        if isinstance(data.get("access_token"), str):
            return data["access_token"]
        nested = data.get("token")
        if isinstance(nested, dict):
            inner = nested.get("access_token") or nested.get("token")
            if isinstance(inner, str):
                return inner
    if isinstance(login_data.get("jwt"), str):
        return login_data["jwt"]
    return None


async def seed():
    print("\n🌱 Travello Seeder")
    print("=" * 45)

    async with httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=30.0
    ) as client:

        # ── LOGIN ──
        print("\n🔐 Logging in...")
        res = await client.post(
            "/auth/login",
            json={
                "email": EMAIL,
                "password": PASSWORD
            }
        )
        print(f"Login status: {res.status_code}")
        login_data = res.json()
        print(f"Login response keys: "
              f"{list(login_data.keys())}")

        token = extract_access_token(login_data)

        if not token:
            print("❌ No token found!")
            print(f"Full response: {login_data}")
            return

        preview = f"{token[:20]}..." if len(token) > 20 else token
        print(f"✓ Token found: {preview}")

        # Try both token formats
        headers_bearer = {
            "Authorization": f"Bearer {token}"
        }
        headers_token = {
            "Authorization": f"Token {token}"
        }

        # ── TEST WHICH HEADER WORKS ──
        print("\n🔍 Testing auth header format...")

        me_bearer = await client.get(
            "/auth/me",
            headers=headers_bearer
        )
        print(f"Bearer format: "
              f"{me_bearer.status_code}")

        if me_bearer.status_code == 200:
            headers = headers_bearer
            user = me_bearer.json()
            print(f"✓ Bearer works!")
        else:
            me_token = await client.get(
                "/auth/me",
                headers=headers_token
            )
            print(f"Token format: "
                  f"{me_token.status_code}")

            if me_token.status_code == 200:
                headers = headers_token
                user = me_token.json()
                print(f"✓ Token format works!")
            else:
                print(f"❌ Both auth formats failed")
                print(f"Bearer response: "
                      f"{me_bearer.text}")
                print(f"Token response: "
                      f"{me_token.text}")
                return

        # Print full user response
        print(f"User response: {user}")

        # Try different field names for id
        user_id = (
            user.get("id") or
            user.get("user_id") or
            user.get("uid") or
            user.get("data", {}).get("id")
        )
        user_name = (
            user.get("full_name") or
            user.get("name") or
            user.get("username") or
            user.get("email")
        )
        print(f"✓ User: {user_name}")
        print(f"✓ ID: {user_id}")

        today = datetime.now()

        # ── CHECK EXISTING GROUPS ──
        print("\n👥 Checking existing groups...")
        groups_res = await client.get(
            "/groups",
            headers=headers
        )
        print(f"Groups status: "
              f"{groups_res.status_code}")

        existing_groups = []
        if groups_res.status_code == 200:
            resp = groups_res.json()
            print(f"Groups response type: "
                  f"{type(resp)}")

            # Handle both list and dict response
            if isinstance(resp, list):
                existing_groups = resp
            elif isinstance(resp, dict):
                existing_groups = (
                    resp.get("groups") or
                    resp.get("data") or
                    resp.get("items") or
                    []
                )
            print(f"✓ Existing groups: "
                  f"{len(existing_groups)}")
            for g in existing_groups:
                print(f"  - {g.get('name')} "
                      f"(id: {g.get('id')})")

        # ── CREATE GROUPS IF NEEDED ──
        group_ids = [g.get("id")
                     for g in existing_groups
                     if g.get("id")]

        if not group_ids:
            print("\n Creating groups...")
            groups_to_create = [
                {
                    "name": "Goa Gang",
                    "description":
                        "Beach trip crew"
                },
                {
                    "name": "Manali Winter",
                    "description":
                        "Mountain trek group"
                },
            ]

            for g in groups_to_create:
                r = await client.post(
                    "/groups",
                    json=g,
                    headers=headers
                )
                print(f"  Create group status: "
                      f"{r.status_code}")
                if r.status_code in [200, 201]:
                    resp = r.json()
                    gid = (
                        resp.get("id") or
                        resp.get("data", {})
                            .get("id")
                    )
                    if gid:
                        group_ids.append(gid)
                        print(f"  ✓ {g['name']} "
                              f"(id:{gid})")
                else:
                    print(f"  ✗ {g['name']}: "
                          f"{r.text[:150]}")

        if not group_ids:
            print("❌ No groups. Cannot continue.")
            print("\nTry creating a group manually")
            print("at localhost:3000/travel-hub")
            return

        print(f"✓ Using group IDs: {group_ids}")

        # ── CHECK EXISTING TRIPS ──
        print("\n✈️ Checking existing trips...")
        trip_ids = []

        for gid in group_ids[:2]:
            r = await client.get(
                f"/groups/{gid}/trips",
                headers=headers
            )
            print(f"Trips for group {gid}: "
                  f"{r.status_code}")

            if r.status_code == 200:
                resp = r.json()
                trips = (
                    resp if isinstance(resp, list)
                    else resp.get("trips") or
                         resp.get("data") or []
                )
                for t in trips:
                    tid = t.get("id")
                    if tid and tid not in trip_ids:
                        trip_ids.append(tid)
                        print(f"  Found trip: "
                              f"{t.get('name')} "
                              f"(id:{tid})")

        # ── CREATE TRIPS IF NEEDED ──
        if not trip_ids:
            print("\n Creating trips...")
            trips_data = [
                {
                    "name": "Goa 2026",
                    "destination": "Goa, India",
                    "start_date": (
                        today + timedelta(days=3)
                    ).strftime("%Y-%m-%d"),
                    "end_date": (
                        today + timedelta(days=10)
                    ).strftime("%Y-%m-%d"),
                    "status": "planning",
                },
                {
                    "name": "Manali Trek",
                    "destination": "Manali, India",
                    "start_date": (
                        today + timedelta(days=60)
                    ).strftime("%Y-%m-%d"),
                    "end_date": (
                        today + timedelta(days=67)
                    ).strftime("%Y-%m-%d"),
                    "status": "planning",
                },
            ]

            for i, trip in enumerate(trips_data):
                gid = group_ids[
                    i % len(group_ids)]
                r = await client.post(
                    f"/groups/{gid}/trips",
                    json=trip,
                    headers=headers
                )
                print(f"  Create trip status: "
                      f"{r.status_code}")
                if r.status_code in [200, 201]:
                    resp = r.json()
                    tid = (
                        resp.get("id") or
                        resp.get("data", {})
                            .get("id")
                    )
                    if tid:
                        trip_ids.append(tid)
                        print(f"  ✓ {trip['name']} "
                              f"(id:{tid})")
                else:
                    print(f"  ✗ {trip['name']}: "
                          f"{r.text[:150]}")

        if not trip_ids:
            print("❌ No trips. Cannot add expenses.")
            return

        # ── ADD EXPENSES ──
        print(f"\n💰 Adding expenses to "
              f"trip {trip_ids[0]}...")

        expenses = [
            {
                "description": "Hotel - 3 nights",
                "amount": 450.00,
                "currency": "USD",
                "category": "accommodation",
                "split_type": "equal",
            },
            {
                "description":
                    "Return flights",
                "amount": 320.00,
                "currency": "USD",
                "category": "transport",
                "split_type": "equal",
            },
            {
                "description":
                    "Dinner at restaurant",
                "amount": 180.00,
                "currency": "USD",
                "category": "food",
                "split_type": "equal",
            },
            {
                "description": "Water sports",
                "amount": 120.00,
                "currency": "USD",
                "category": "activities",
                "split_type": "equal",
            },
            {
                "description": "Grocery shopping",
                "amount": 65.00,
                "currency": "USD",
                "category": "food",
                "split_type": "equal",
            },
            {
                "description": "Cab from airport",
                "amount": 35.00,
                "currency": "USD",
                "category": "transport",
                "split_type": "equal",
            },
            {
                "description":
                    "Museum tickets",
                "amount": 40.00,
                "currency": "USD",
                "category": "activities",
                "split_type": "equal",
            },
            {
                "description": "Beach lunch",
                "amount": 80.00,
                "currency": "USD",
                "category": "food",
                "split_type": "equal",
            },
        ]

        added = 0
        for exp in expenses:
            r = await client.post(
                f"/trips/{trip_ids[0]}/expenses",
                json=exp,
                headers=headers
            )
            if r.status_code in [200, 201]:
                added += 1
                print(f"  ✓ ${exp['amount']}"
                      f" {exp['description']}")
            else:
                print(f"  ✗ {exp['description']}"
                      f": {r.status_code}"
                      f" {r.text[:100]}")

        # ── ADD PINS ──
        print("\n📍 Adding map pins...")
        pins = [
            {
                "name": "Baga Beach",
                "latitude": 15.5552,
                "longitude": 73.7516,
                "flag_type": "gang_trip",
                "notes": "Main beach spot"
            },
            {
                "name": "Fort Aguada",
                "latitude": 15.4925,
                "longitude": 73.7751,
                "flag_type": "visited",
                "notes": "Historical fort"
            },
            {
                "name": "Dudhsagar Falls",
                "latitude": 15.3144,
                "longitude": 74.3148,
                "flag_type": "dream",
                "notes": "Must visit waterfall"
            },
            {
                "name": "Rohtang Pass",
                "latitude": 32.3712,
                "longitude": 77.2367,
                "flag_type": "dream",
                "notes": "Snow point Manali"
            },
            {
                "name": "Solang Valley",
                "latitude": 32.3192,
                "longitude": 77.1512,
                "flag_type": "gang_trip",
                "notes": "Skiing and adventure"
            },
        ]

        pins_added = 0
        for pin in pins:
            r = await client.post(
                "/pins",
                json=pin,
                headers=headers
            )
            if r.status_code in [200, 201]:
                pins_added += 1
                print(f"  ✓ {pin['name']}")
            else:
                print(f"  ✗ {pin['name']}: "
                      f"{r.status_code}")

        # ── ADD POLLS ──
        print("\n🗳️ Adding polls...")
        polls_added = 0
        polls = [
            {
                "question":
                    "Which hotel to book?",
                "options": [
                    {"text": "Hotel Royal Goa"},
                    {"text": "Airbnb Villa"},
                    {"text": "Zostel Goa"},
                ]
            },
            {
                "question":
                    "Beach or Waterfall on Day 3?",
                "options": [
                    {"text": "Baga Beach"},
                    {"text": "Dudhsagar Falls"},
                ]
            },
        ]

        for poll in polls:
            r = await client.post(
                f"/trips/{trip_ids[0]}/polls",
                json=poll,
                headers=headers
            )
            if r.status_code in [200, 201]:
                polls_added += 1
                print(f"  ✓ {poll['question']}")
            else:
                print(f"  ✗ Poll: "
                      f"{r.status_code} "
                      f"{r.text[:100]}")

        # ── DONE ──
        print("\n" + "=" * 45)
        print("✅ Done!")
        print(f"  Groups: {len(group_ids)}")
        print(f"  Trips: {len(trip_ids)}")
        print(f"  Expenses: {added}")
        print(f"  Pins: {pins_added}")
        print(f"  Polls: {polls_added}")
        print(f"\n🌐 Check now:")
        print(f"  localhost:3000/dashboard")
        print(f"  localhost:3000/split-activities")
        print(f"  localhost:3000/map")
        print("=" * 45 + "\n")

if __name__ == "__main__":
    asyncio.run(seed())