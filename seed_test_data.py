"""
Travello Test Data Seeder
Run: python seed_test_data.py
Adds 5 test users + 2 groups + trips
+ pins + expenses all at once
"""

import asyncio
import httpx
import json
from datetime import datetime, timedelta
import random

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIG — change these if needed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE_URL = "http://localhost:8000/api/v1"
# OR use production:
# BASE_URL = "https://group-travel-os-api-704551807369.asia-south1.run.app/api/v1"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST USERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST_USERS = [
    {
        "full_name": "Bharath Nidumolu",
        "email": "bharath@travello.app",
        "username": "bharath_nidumolu",
        "password": "Test@1234",
        "date_of_birth": "1997-05-15",
        "home_city": "Hyderabad",
        "travel_status": "Planning Bangkok",
        "bio": "Travel enthusiast. Weekend adventurer.",
    },
    {
        "full_name": "Ravi Kumar",
        "email": "ravi@travello.app",
        "username": "ravi_kumar",
        "password": "Test@1234",
        "date_of_birth": "1995-03-22",
        "home_city": "Bangalore",
        "travel_status": "Just got back from Goa",
        "bio": "Mountains and beaches guy.",
    },
    {
        "full_name": "Priya Sharma",
        "email": "priya@travello.app",
        "username": "priya_sharma",
        "password": "Test@1234",
        "date_of_birth": "1998-08-10",
        "home_city": "Mumbai",
        "travel_status": "Exploring Rajasthan",
        "bio": "Solo traveler. Foodie.",
    },
    {
        "full_name": "Karthik Mehta",
        "email": "karthik@travello.app",
        "username": "karthik_mehta",
        "password": "Test@1234",
        "date_of_birth": "1996-11-30",
        "home_city": "Chennai",
        "travel_status": "Planning Manali trip",
        "bio": "Trekking is life.",
    },
    {
        "full_name": "Sneha Reddy",
        "email": "sneha@travello.app",
        "username": "sneha_reddy",
        "password": "Test@1234",
        "date_of_birth": "1999-02-14",
        "home_city": "Hyderabad",
        "travel_status": "Want to visit Japan",
        "bio": "Culture and history lover.",
    },
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST GROUPS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST_GROUPS = [
    {
        "name": "Goa Gang",
        "description": "Our annual Goa trip crew",
    },
    {
        "name": "Manali Winter",
        "description": "Winter trek to Manali",
    },
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST TRIPS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def get_trips():
    today = datetime.now()
    return [
        {
            "name": "Goa 2026",
            "destination": "Goa, India",
            "start_date": (today + timedelta(days=3))
                .strftime("%Y-%m-%d"),
            "end_date": (today + timedelta(days=10))
                .strftime("%Y-%m-%d"),
            "status": "planning",
            "budget": 15000,
        },
        {
            "name": "Manali Winter Trek",
            "destination": "Manali, Himachal Pradesh",
            "start_date": (today + timedelta(days=60))
                .strftime("%Y-%m-%d"),
            "end_date": (today + timedelta(days=67))
                .strftime("%Y-%m-%d"),
            "status": "planning",
            "budget": 20000,
        },
    ]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST PINS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST_PINS = [
    {
        "name": "Baga Beach",
        "latitude": 15.5552,
        "longitude": 73.7516,
        "flag_type": "dream",
        "notes": "Must visit beach in Goa",
    },
    {
        "name": "Fort Aguada",
        "latitude": 15.4925,
        "longitude": 73.7751,
        "flag_type": "interesting",
        "notes": "Old Portuguese fort",
    },
    {
        "name": "Dudhsagar Falls",
        "latitude": 15.3144,
        "longitude": 74.3148,
        "flag_type": "gang_trip",
        "notes": "Waterfall trip with group",
    },
    {
        "name": "Charminar",
        "latitude": 17.3616,
        "longitude": 78.4747,
        "flag_type": "visited",
        "notes": "Already visited, amazing!",
    },
    {
        "name": "Hussain Sagar Lake",
        "latitude": 17.4239,
        "longitude": 78.4738,
        "flag_type": "gang_trip",
        "notes": "Great spot for group photos",
    },
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST EXPENSES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST_EXPENSES = [
    {
        "description": "Hotel Royal Goa - 3 nights",
        "amount": 9000,
        "currency": "INR",
        "category": "accommodation",
        "split_type": "equal",
    },
    {
        "description": "Train tickets to Goa",
        "amount": 3200,
        "currency": "INR",
        "category": "transport",
        "split_type": "equal",
    },
    {
        "description": "Dinner at La Plage",
        "amount": 4500,
        "currency": "INR",
        "category": "food",
        "split_type": "equal",
    },
    {
        "description": "Water sports at Baga",
        "amount": 2000,
        "currency": "INR",
        "category": "activities",
        "split_type": "equal",
    },
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN SEEDER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def seed():
    print("\n🌱 Travello Test Data Seeder")
    print("=" * 40)

    tokens = {}
    user_ids = {}

    async with httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=30.0
    ) as client:

        # ── STEP 1: Register users ──
        print("\n📝 Creating test users...")
        for user in TEST_USERS:
            try:
                res = await client.post(
                    "/auth/register",
                    json=user
                )
                if res.status_code in [200, 201]:
                    print(f"  ✓ {user['full_name']}")
                elif res.status_code == 400:
                    print(f"  ⚠ {user['full_name']} "
                          f"already exists")
                else:
                    print(f"  ✗ {user['full_name']}: "
                          f"{res.text}")
            except Exception as e:
                print(f"  ✗ Error: {e}")

        # ── STEP 2: Login all users ──
        print("\n🔐 Logging in users...")
        for user in TEST_USERS:
            try:
                res = await client.post(
                    "/auth/login",
                    json={
                        "email": user["email"],
                        "password": user["password"]
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    # API returns RegisterResponse: { user, token: { access_token, ... } }
                    token = None
                    t = data.get("token")
                    if isinstance(t, dict):
                        token = t.get("access_token")
                    if not token:
                        token = data.get("access_token")
                    tokens[user["email"]] = token
                    if not token:
                        print(
                            f"  ✗ {user['full_name']}: "
                            "no access_token in response (check API shape)"
                        )
                        continue
                    # Get user id
                    me_res = await client.get(
                        "/auth/me",
                        headers={
                            "Authorization":
                            f"Bearer {token}"
                        }
                    )
                    if me_res.status_code == 200:
                        uid = me_res.json().get("id")
                        user_ids[user["email"]] = uid
                    print(f"  ✓ {user['full_name']}")
                else:
                    print(f"  ✗ {user['email']}: "
                          f"{res.text}")
            except Exception as e:
                print(f"  ✗ Error: {e}")

        # Use Bharath as primary user
        primary_email = TEST_USERS[0]["email"]
        primary_token = tokens.get(primary_email)
        if not primary_token:
            print("\n❌ Primary user login failed.")
            return

        headers = {
            "Authorization":
            f"Bearer {primary_token}"
        }

        # ── STEP 3: Create groups ──
        print("\n👥 Creating groups...")
        group_ids = []
        for group in TEST_GROUPS:
            try:
                res = await client.post(
                    "/groups",
                    json=group,
                    headers=headers
                )
                if res.status_code in [200, 201]:
                    gid = res.json().get("id")
                    group_ids.append(gid)
                    print(f"  ✓ {group['name']} "
                          f"(id: {gid})")
                else:
                    print(f"  ✗ {group['name']}: "
                          f"{res.text}")
            except Exception as e:
                print(f"  ✗ Error: {e}")

        # ── STEP 4: Add members ──
        if group_ids:
            print("\n👤 Adding members to groups...")
            goa_group_id = group_ids[0]

            for user in TEST_USERS[1:4]:
                uid = user_ids.get(user["email"])
                if uid:
                    try:
                        res = await client.post(
                            f"/groups/{goa_group_id}"
                            f"/members",
                            json={"user_id": uid},
                            headers=headers
                        )
                        if res.status_code in [200,201]:
                            print(f"  ✓ Added "
                                  f"{user['full_name']}"
                                  f" to Goa Gang")
                        else:
                            # Try invite code method
                            print(f"  ⚠ {user['full_name']}"
                                  f": {res.status_code}")
                    except Exception as e:
                        print(f"  ✗ Error: {e}")

        # ── STEP 5: Create trips ──
        print("\n✈️ Creating trips...")
        trip_ids = []
        trips = get_trips()
        for i, trip in enumerate(trips):
            gid = group_ids[i] if i < len(group_ids) \
                else group_ids[0]
            try:
                res = await client.post(
                    f"/groups/{gid}/trips",
                    json=trip,
                    headers=headers
                )
                if res.status_code in [200, 201]:
                    tid = res.json().get("id")
                    trip_ids.append(tid)
                    print(f"  ✓ {trip['name']} "
                          f"(id: {tid})")
                else:
                    print(f"  ✗ {trip['name']}: "
                          f"{res.text}")
            except Exception as e:
                print(f"  ✗ Error: {e}")

        # ── STEP 6: Add pins ──
        print("\n📍 Adding map pins...")
        for pin in TEST_PINS:
            try:
                res = await client.post(
                    "/pins",
                    json=pin,
                    headers=headers
                )
                if res.status_code in [200, 201]:
                    print(f"  ✓ {pin['name']}")
                else:
                    print(f"  ✗ {pin['name']}: "
                          f"{res.text}")
            except Exception as e:
                print(f"  ✗ Error: {e}")

        # ── STEP 7: Add expenses ──
        if trip_ids:
            print("\n💰 Adding expenses...")
            goa_trip_id = trip_ids[0]
            for exp in TEST_EXPENSES:
                try:
                    res = await client.post(
                        f"/trips/{goa_trip_id}"
                        f"/expenses",
                        json=exp,
                        headers=headers
                    )
                    if res.status_code in [200, 201]:
                        print(f"  ✓ {exp['description']}"
                              f" ₹{exp['amount']}")
                    else:
                        print(f"  ✗ {exp['description']}"
                              f": {res.text}")
                except Exception as e:
                    print(f"  ✗ Error: {e}")

        # ── STEP 8: Create polls ──
        if trip_ids:
            print("\n🗳️ Creating polls...")
            goa_trip_id = trip_ids[0]
            polls = [
                {
                    "question": "Which hotel should we book?",
                    "options": [
                        {"text": "Hotel Royal Goa"},
                        {"text": "Airbnb Beach Villa"},
                        {"text": "Zostel Goa"},
                    ]
                },
                {
                    "question": "Beach or Waterfall on Day 3?",
                    "options": [
                        {"text": "Baga Beach"},
                        {"text": "Dudhsagar Falls"},
                    ]
                }
            ]
            for poll in polls:
                try:
                    res = await client.post(
                        f"/trips/{goa_trip_id}/polls",
                        json=poll,
                        headers=headers
                    )
                    if res.status_code in [200, 201]:
                        print(f"  ✓ {poll['question']}")
                    else:
                        print(f"  ✗ {poll['question']}: "
                              f"{res.text}")
                except Exception as e:
                    print(f"  ✗ Error: {e}")

    # ── DONE ──
    print("\n" + "=" * 40)
    print("✅ Seeding complete!")
    print("\n📋 Test credentials:")
    for user in TEST_USERS:
        print(f"  {user['email']} / Test@1234")
    print("\n🌐 Login at:")
    print("  http://localhost:3000/login")
    print("  or group-travel-os.vercel.app/login")
    print("=" * 40 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())