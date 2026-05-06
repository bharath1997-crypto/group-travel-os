import json
import os
import sys

# Add project root to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.explore_event_normalizer import normalize_dataforseo_event

# Mocked response based on DataForSEO Google Events API Documentation
mock_dataforseo_item = {
    "type": "events_search",
    "title": "Summer Jazz Festival 2026",
    "snippet": "Join us for the best outdoor jazz performances in the city.",
    "url": "https://example.com/summer-jazz",
    "image_url": "https://example.com/images/jazz.jpg",
    "location": {
        "name": "Central Park Main Stage",
        "address": "Central Park, New York, NY"
    },
    "date": {
        "start_datetime": "2026-06-15 18:00:00",
        "end_datetime": "2026-06-15 23:00:00"
    },
    "ticket_info": [
        {"ticket_type": "Free Admission"}
    ]
}

def run_test():
    print("--- 1. RAW DATAFORSEO RESPONSE ITEM ---")
    print(json.dumps(mock_dataforseo_item, indent=2))
    
    print("\n--- 2. PASSING THROUGH NORMALIZER... ---")
    normalized = normalize_dataforseo_event(mock_dataforseo_item, "New York")
    
    # We must convert datetime to string to print as JSON
    normalized_for_print = normalized.copy()
    normalized_for_print["start_time"] = normalized_for_print["start_time"].isoformat() if normalized_for_print["start_time"] else None
    
    print("\n--- 3. NORMALIZED OUTPUT FOR SUPABASE ---")
    print(json.dumps(normalized_for_print, indent=2))

if __name__ == "__main__":
    run_test()
