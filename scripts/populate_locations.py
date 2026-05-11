import os
import sys

# Prepend repo root so we can run from anywhere
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import csv
import io
import json
import zipfile
import httpx
from sqlalchemy.orm import Session
from app.utils.database import SessionLocal
from app.models.location_hashtag import LocationHashtag
import google.generativeai as genai
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()

CITIES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
ADMIN1_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"
COUNTRY_URL = "https://download.geonames.org/export/dump/countryInfo.txt"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

async def download_file(client, url):
    print(f"Downloading {os.path.basename(url)}...")
    res = await client.get(url)
    res.raise_for_status()
    return res.content

def parse_countries(content):
    countries = {}
    for line in content.decode('utf-8').splitlines():
        if line.startswith('#'):
            continue
        parts = line.split('\t')
        if len(parts) > 4:
            countries[parts[0]] = parts[4]
    return countries

def parse_admin1(content):
    states = {}
    for line in content.decode('utf-8').splitlines():
        parts = line.split('\t')
        if len(parts) > 1:
            states[parts[0]] = parts[1]
    return states

def generate_hashtags_batch(city_names: list[str]) -> dict[str, list[str]]:
    """Use Gemini to generate hashtags for a batch of cities"""
    if not GEMINI_API_KEY:
        # Fallback
        result = {}
        for city in city_names:
            city_clean = city.lower().replace(" ", "")
            result[city] = [f"#{city_clean}", f"#{city_clean}travel", f"#{city_clean}life"]
        return result

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = f"""Generate 5 popular travel hashtags for each city in this list: {json.dumps(city_names)}.
    Return ONLY a JSON object where keys are the city names from the list and values are arrays of strings (the hashtags).
    Example: {{"Chicago": ["#chicago", "#chitown"], "Paris": ["#paris"]}}
    No explanation. Just the JSON object."""
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error generating hashtags for batch: {e}")
        # Fallback
        result = {}
        for city in city_names:
            city_clean = city.lower().replace(" ", "")
            result[city] = [f"#{city_clean}", f"#{city_clean}travel"]
        return result

async def populate():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Download files
        countries_data = await download_file(client, COUNTRY_URL)
        admin1_data = await download_file(client, ADMIN1_URL)
        cities_zip_data = await download_file(client, CITIES_URL)
        
        # 2. Parse lookups
        countries_dict = parse_countries(countries_data)
        states_dict = parse_admin1(admin1_data)
        
        # 3. Unzip cities
        with zipfile.ZipFile(io.BytesIO(cities_zip_data)) as z:
            cities_content = z.read("cities15000.txt").decode('utf-8')
            
        lines = cities_content.splitlines()
        print(f"Parsing {len(lines)} cities...")
        
        db: Session = SessionLocal()
        
        # We need to batch cities for Gemini
        batch_size = 50
        current_batch = []
        city_rows = []
        
        total_saved = 0
        
        for line in tqdm(lines, desc="Processing cities"):
            parts = line.split('\t')
            if len(parts) < 15:
                continue
                
            geonameid = parts[0]
            name = parts[1]
            asciiname = parts[2]
            lat = float(parts[4])
            lon = float(parts[5])
            country_code = parts[8]
            admin1_code = parts[10]
            population = int(parts[14])
            
            if population < 15000:
                continue
                
            country_name = countries_dict.get(country_code, country_code)
            state_key = f"{country_code}.{admin1_code}"
            state_name = states_dict.get(state_key, admin1_code)
            
            # Skip if already exists
            exists = db.query(LocationHashtag).filter(
                LocationHashtag.geonames_id == geonameid
            ).first()
            if exists:
                continue
                
            current_batch.append(asciiname)
            city_rows.append({
                "geonames_id": geonameid,
                "city": asciiname,
                "state": state_name,
                "country": country_name,
                "lat": lat,
                "lon": lon,
                "population": population
            })
            
            if len(current_batch) >= batch_size:
                # Generate hashtags
                hashtags_map = generate_hashtags_batch(current_batch)
                
                # Create rows
                for row in city_rows:
                    city_name = row["city"]
                    hashtags = hashtags_map.get(city_name, [f"#{city_name.lower().replace(' ', '')}"])
                    
                    loc = LocationHashtag(
                        geonames_id=row["geonames_id"],
                        city=row["city"],
                        state=row["state"],
                        country=row["country"],
                        lat=row["lat"],
                        lon=row["lon"],
                        population=row["population"],
                        hashtags=hashtags,
                        category="city"
                    )
                    db.add(loc)
                    total_saved += 1
                    
                    if total_saved % 500 == 0:
                        db.commit()
                        print(f"Saved {total_saved} locations...")
                        
                current_batch = []
                city_rows = []
                
        # Handle remaining
        if current_batch:
            hashtags_map = generate_hashtags_batch(current_batch)
            for row in city_rows:
                city_name = row["city"]
                hashtags = hashtags_map.get(city_name, [f"#{city_name.lower().replace(' ', '')}"])
                loc = LocationHashtag(
                    geonames_id=row["geonames_id"],
                    city=row["city"],
                    state=row["state"],
                    country=row["country"],
                    lat=row["lat"],
                    lon=row["lon"],
                    population=row["population"],
                    hashtags=hashtags,
                    category="city"
                )
                db.add(loc)
                total_saved += 1
                
        db.commit()
        db.close()
        print(f"Done! Total: {total_saved} locations")

if __name__ == "__main__":
    asyncio.run(populate())
