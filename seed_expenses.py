# Save as: seed_expenses.py
# Run: python seed_expenses.py

import asyncio
import httpx

BASE_URL = "https://group-travel-os-api-704551807369.asia-south1.run.app/api/v1"

# Your login credentials
EMAIL = "bharath@travello.app"
PASSWORD = "Test@1234"

async def seed():
    print("\n💸 Seeding expense data...")
    print("=" * 40)

    async with httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=30.0
    ) as client:

        # Login
        res = await client.post(
            "/auth/login",
            json={
                "email": EMAIL,
                "password": PASSWORD
            }
        )
        if res.status_code != 200:
            print(f"❌ Login failed: {res.text}")
            print("Try with your actual email")
            return

        login_data = res.json()
        # API returns { "user": ..., "token": { "access_token": "...", ... } }
        token = login_data.get("access_token")
        if not token and isinstance(login_data.get("token"), dict):
            token = login_data["token"].get("access_token")
        if not token:
            print(f"❌ No access token in login response: {list(login_data.keys())}")
            return

        headers = {
            "Authorization": f"Bearer {token}"
        }
        print("✓ Logged in")

        # Get groups
        groups_res = await client.get(
            "/groups",
            headers=headers
        )
        raw = groups_res.json()
        if groups_res.status_code != 200:
            print(f"❌ GET /groups failed: {groups_res.status_code} {raw}")
            return

        # Normalize to list (error payloads are dicts without numeric keys)
        if isinstance(raw, list):
            groups = raw
        elif isinstance(raw, dict) and "items" in raw:
            groups = raw["items"]
        elif isinstance(raw, dict) and isinstance(raw.get("detail"), str):
            print(f"❌ Groups error: {raw['detail']}")
            return
        else:
            preview = repr(raw)[:200]
            print(f"❌ Unexpected /groups shape: {type(raw)} {preview}")
            return

        if not groups:
            print("❌ No groups found")
            print("Run seed_test_data.py first")
            return

        print(f"✓ Found {len(groups)} groups")

        # Use first trip found across all groups (first group may have none)
        trip_id = None
        trip_title = ""
        group_used = None
        for g in groups:
            gid = g["id"]
            trips_res = await client.get(
                f"/groups/{gid}/trips",
                headers=headers,
            )
            trips = trips_res.json()
            if trips_res.status_code != 200:
                print(f"  (skip group {gid}: HTTP {trips_res.status_code})")
                continue
            if not isinstance(trips, list) or not trips:
                continue
            trip_id = trips[0]["id"]
            trip_title = trips[0].get("title") or trips[0].get("name", "")
            group_used = g.get("name") or str(gid)
            print(f"✓ Using trip: {trip_title} (group: {group_used})")
            break

        if not trip_id:
            # No trips in any group — create one on the first group
            first_group_id = groups[0]["id"]
            create_res = await client.post(
                f"/groups/{first_group_id}/trips",
                headers=headers,
                json={
                    "title": "Demo trip (seed expenses)",
                    "description": "Created by seed_expenses.py",
                },
            )
            if create_res.status_code not in (200, 201):
                print(
                    f"❌ No trips found and could not create trip: "
                    f"{create_res.status_code} {create_res.text[:200]}"
                )
                print("Create a trip in the app or run seed_test_data.py")
                return
            new_trip = create_res.json()
            trip_id = new_trip["id"]
            trip_title = new_trip.get("title", "Demo trip")
            print(
                f"✓ Created trip: {trip_title} "
                f"(group: {groups[0].get('name', first_group_id)})"
            )

        # Add expenses
        # ExpenseCreate: description, amount, currency, split_with (empty = all members)
        expenses = [
            {"description": "Hotel Royal Stay - 3 nights", "amount": 450.00, "currency": "USD"},
            {"description": "Flight tickets", "amount": 320.00, "currency": "USD"},
            {"description": "Dinner at La Plage", "amount": 180.00, "currency": "USD"},
            {"description": "Water sports at beach", "amount": 120.00, "currency": "USD"},
            {"description": "Grocery shopping", "amount": 85.00, "currency": "USD"},
            {"description": "Taxi to airport", "amount": 45.00, "currency": "USD"},
            {"description": "Museum tickets", "amount": 60.00, "currency": "USD"},
            {"description": "Lunch at cafe", "amount": 95.00, "currency": "USD"},
        ]

        print("\n💰 Adding expenses...")
        for exp in expenses:
            body = {
                "description": exp["description"],
                "amount": exp["amount"],
                "currency": exp["currency"],
                "split_with": [],
            }
            res = await client.post(
                f"/trips/{trip_id}/expenses",
                json=body,
                headers=headers
            )
            if res.status_code in [200, 201]:
                print(
                    f"  ✓ {exp['description']}"
                    f" ${exp['amount']}"
                )
            else:
                print(
                    f"  ✗ {exp['description']}"
                    f": {res.status_code}"
                    f" {res.text[:100]}"
                )

        # Check balances
        print("\n⚖️ Checking balances...")
        bal_res = await client.get(
            f"/trips/{trip_id}/expenses/summary",
            headers=headers
        )
        if bal_res.status_code == 200:
            summary = bal_res.json()
            print("  ✓ Balance summary loaded")
            if isinstance(summary, list):
                print(f"  Pairwise balances: {len(summary)} lines")
        else:
            print(
                f"  Balance endpoint: "
                f"{bal_res.status_code}"
            )

    print("\n" + "=" * 40)
    print("✅ Done! Check your app now.")
    print(
        "Go to: "
        "localhost:3000/split-activities"
    )
    print("=" * 40 + "\n")

if __name__ == "__main__":
    asyncio.run(seed())