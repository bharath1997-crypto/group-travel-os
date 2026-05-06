import json
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Load .env manually to ensure we pick up the newly added credentials
load_dotenv()

from app.services.external.dataforseo_provider import DataForSEOProvider
from app.services.explore_event_normalizer import normalize_dataforseo_event

def run_live_test():
    login = os.getenv("DATAFORSEO_LOGIN")
    password = os.getenv("DATAFORSEO_PASSWORD")
    
    if not login or not password:
        print("ERROR: DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD is not set in .env")
        return

    print("--- 1. INITIALIZING PROVIDER ---")
    
    # Configure basic logging so we can see the errors
    import logging
    logging.basicConfig(level=logging.DEBUG)
    
    provider = DataForSEOProvider()
    city = "Chicago"
    category = "music"
    
    print(f"Fetching events for: {city} ...")
    raw_events = provider.fetch_events(city=city, category=category)
    
    if not raw_events:
        print("API returned an empty list. Look at the DEBUG logs above to see the exact error message that DataForSEO returned.")
        return
        
    print(f"\n--- 2. RAW RESPONSE (Top-level keys of first item) ---")
    first_item = raw_events[0]
    print(list(first_item.keys()))
    
    print(f"\n--- 3. FIRST EVENT SHAPE (Raw DataForSEO) ---")
    print(json.dumps(first_item, indent=2))
    
    print("\n--- 4. NORMALIZED OUTPUT ---")
    normalized = normalize_dataforseo_event(first_item, city)
    
    # Format datetime for printing
    normalized_for_print = normalized.copy()
    if normalized_for_print["start_time"]:
        normalized_for_print["start_time"] = normalized_for_print["start_time"].isoformat()
        
    print(json.dumps(normalized_for_print, indent=2))

if __name__ == "__main__":
    run_live_test()
