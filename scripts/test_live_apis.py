import asyncio
import os
import sys
import httpx
from datetime import datetime

# Setup path so we can import config
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from config import settings

async def test_gemini():
    print("Testing Google Gemini API (gemini-2.5-flash)...")
    key = (settings.gemini_api_key or "").strip()
    if not key:
        return "[NOT CONFIGURED] No GEMINI_API_KEY found"
    try:
        from app.services.ai_assistant_service import generate_gemini_content
        res = await generate_gemini_content("Hello! Respond with exactly 'CONNECTED' if you hear me.")
        if "CONNECTED" in str(res).upper():
            return "[SUCCESS] ACTIVE (Successfully connected & generated content!)"
        elif res:
            return f"[SUCCESS] ACTIVE (Generated response: '{res[:30]}')"
        else:
            return "[FAILED] Empty response from Gemini"
    except Exception as e:
        if "Quota exceeded" in str(e) or "429" in str(e):
            return "[RATE LIMIT EXCEEDED] Key is valid and verified, but has reached Google's daily/minute limit. (Requires upgrading to pay-as-you-go or waiting for cooldown)"
        return f"[FAILED] Error: {e}"

async def test_ticketmaster():
    print("Testing Ticketmaster Live Events Discovery API...")
    key = (settings.ticketmaster_api_key or "").strip()
    if not key:
        return "[NOT CONFIGURED] No TICKETMASTER_API_KEY found"
    try:
        url = "https://app.ticketmaster.com/discovery/v2/events.json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params={"apikey": key, "city": "Chicago", "size": 1})
            if r.status_code == 200:
                data = r.json()
                total = data.get("page", {}).get("totalElements", 0)
                return f"[SUCCESS] ACTIVE (Connected! Successfully found {total} total events in Chicago)"
            elif r.status_code == 401:
                return "[FAILED] AUTHENTICATION FAILED (Invalid Ticketmaster API Key)"
            else:
                return f"[FAILED] HTTP ERROR {r.status_code} ({r.text[:100]})"
    except Exception as e:
        return f"[FAILED] Error: {e}"

async def test_google_places():
    print("Testing Google Places API (Destination Discovery)...")
    key = (settings.google_places_api_key or "").strip()
    if not key:
        return "[NOT CONFIGURED] No GOOGLE_PLACES_KEY found"
    try:
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params={"query": "attractions in Chicago", "key": key})
            if r.status_code == 200:
                data = r.json()
                status = data.get("status")
                if status == "OK":
                    results = data.get("results", [])
                    name = results[0].get("name", "Unknown Spot") if results else "No spots"
                    return f"[SUCCESS] ACTIVE (Connected! Successfully retrieved spots from Google. Top attraction in Chicago: '{name}')"
                else:
                    return f"[FAILED] API STATUS: {status} ({data.get('error_message', 'No error message')})"
            elif r.status_code in (401, 403):
                return "[FAILED] AUTHENTICATION FAILED (Invalid Google Places API Key)"
            else:
                return f"[FAILED] HTTP ERROR {r.status_code}"
    except Exception as e:
        return f"[FAILED] Error: {e}"

async def test_openstreetmap():
    print("Testing OpenStreetMap / Overpass API (Attractions Rescue)...")
    try:
        url = "https://overpass-api.de/api/interpreter"
        query = '[out:json][timeout:15];node["tourism"="attraction"](41.87,-87.63,41.89,-87.61);out body 1;'
        headers = {"User-Agent": "RovvyTravelPlanner/1.0 (contact@rovvy.app)"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, data=f"data={query}", headers=headers)
            if r.status_code == 200:
                data = r.json()
                elements = len(data.get("elements", []))
                return f"[SUCCESS] ACTIVE (100% Free! Connected and successfully fetched {elements} elements)"
            else:
                return f"[FAILED] HTTP ERROR {r.status_code}"
    except Exception as e:
        return f"[FAILED] Error: {e}"

async def test_gnews_rss():
    print("Testing Google News RSS Discovery...")
    try:
        url = "https://news.google.com/rss/search?q=Chicago+travel&hl=en-US&gl=US&ceid=US:en"
        headers = {"User-Agent": "Mozilla/5.0"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200 and "<rss" in r.text:
                return "[SUCCESS] ACTIVE (100% Free! Connected and fetched latest RSS travel feed successfully)"
            else:
                return f"[FAILED] HTTP Status: {r.status_code}"
    except Exception as e:
        return f"[FAILED] Error: {e}"

async def test_openweather():
    print("Testing OpenWeatherMap API...")
    key = (settings.openweathermap_api_key or settings.openweather_api_key or "").strip()
    if not key:
        return "[NOT CONFIGURED] No OPENWEATHERMAP_API_KEY found"
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params={"q": "Chicago", "appid": key, "units": "imperial"})
            if r.status_code == 200:
                data = r.json()
                temp = data.get("main", {}).get("temp", 0)
                desc = data.get("weather", [{}])[0].get("description", "clear")
                return f"[SUCCESS] ACTIVE (Connected! Weather in Chicago is {temp} degrees F, {desc})"
            elif r.status_code in (401, 403):
                return "[FAILED] AUTHENTICATION FAILED (Invalid OpenWeatherMap API Key)"
            else:
                return f"[FAILED] HTTP ERROR {r.status_code} ({r.text[:100]})"
    except Exception as e:
        return f"[FAILED] Error: {e}"

async def main():
    print("=================================================================")
    print("              ROVVY EXPLORER API INTEGRATION CHECKER             ")
    print(f"              Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                 ")
    print("=================================================================\n")
    
    gemini_res = await test_gemini()
    print(f"RESULT: {gemini_res}\n")
    
    tm_res = await test_ticketmaster()
    print(f"RESULT: {tm_res}\n")
    
    gp_res = await test_google_places()
    print(f"RESULT: {gp_res}\n")
    
    osm_res = await test_openstreetmap()
    print(f"RESULT: {osm_res}\n")
    
    news_res = await test_gnews_rss()
    print(f"RESULT: {news_res}\n")
    
    weather_res = await test_openweather()
    print(f"RESULT: {weather_res}\n")
    
    print("=================================================================")
    print("                       VERIFICATION COMPLETE                     ")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(main())
