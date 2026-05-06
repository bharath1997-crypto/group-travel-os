import sys
import os
import traceback

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.external.dataforseo_provider import DataForSEOProvider

def main():
    print("Testing DataForSEO for New York...")
    try:
        provider = DataForSEOProvider()
        events = provider.fetch_events(city="New York", category="events")
        print(f"Number of events returned: {len(events)}")
        if not events:
            print("DataForSEO returned 0 events. It might be returning the cached 40501 error!")
    except Exception as e:
        print("CRASHED!")
        traceback.print_exc()

if __name__ == "__main__":
    main()
