import httpx
import json
import os

# Mock settings/env for test
GEONAMES_USERNAME = "travello"

def test_api(name, url, method="GET", params=None, content=None, headers=None):
    print(f"\n--- Testing {name} ---")
    try:
        if method == "GET":
            r = httpx.get(url, params=params, headers=headers, timeout=10)
        else:
            r = httpx.post(url, content=content, headers=headers, timeout=10)
            
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            # Check if JSON
            try:
                data = r.json()
                print(f"✅ Success (JSON)")
                # Print a small snippet of data
                if isinstance(data, list):
                    print(f"Sample: {json.dumps(data[:1], indent=2)}")
                else:
                    keys = list(data.keys())[:5]
                    print(f"Top Keys: {keys}")
            except:
                print(f"✅ Success (Text, first 100 chars): {r.text[:100]}...")
            return True
        else:
            print(f"❌ Error {r.status_code}: {r.text[:200]}")
            return False
    except Exception as e:
        print(f"💥 Exception: {e}")
        return False

# 1. Weather: Open-Meteo
test_api("Open-Meteo", "https://api.open-meteo.com/v1/forecast", params={"latitude": 41.8781, "longitude": -87.6298, "current_weather": "true"})

# 2. Currency: ER-API (No Auth replacement for Exchangerate.host)
test_api("ER-API", "https://open.er-api.com/v6/latest/USD")

# 3. Podcasts: iTunes
test_api("iTunes", "https://itunes.apple.com/search", params={"term": "Chicago travel", "media": "podcast", "limit": 2})

# 4. Radio: Radio Browser
test_api("Radio Browser", "https://de1.api.radio-browser.info/json/stations/bycountry/US", params={"limit": 2})

# 5. Fallback Geocode: Nominatim
test_api("Nominatim", "https://nominatim.openstreetmap.org/reverse", 
         params={"lat": 41.8781, "lon": -87.6298, "format": "json"},
         headers={"User-Agent": "TravelloTest/1.0"})

# 6. Fallback Features: Overpass
overpass_query = """
[out:json];
(
  node["tourism"](around:5000,41.8781,-87.6298);
);
out body 5;
"""
test_api("Overpass", "https://overpass-api.de/api/interpreter", method="POST", content=overpass_query)

# 7. Fallback Cities: GeoNames
test_api("GeoNames", "http://api.geonames.org/findNearbyPlaceNameJSON", 
         params={"lat": 41.8781, "lng": -87.6298, "username": GEONAMES_USERNAME, "maxRows": 2})
