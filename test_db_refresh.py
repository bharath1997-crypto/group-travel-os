import sys
import os
import traceback

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.utils.database import SessionLocal
from app.services.explore_service import _refresh_cache_for_city_task
from app.models.explore_event import ExploreEvent

def main():
    print("Connecting to DB...")
    db = SessionLocal()
    try:
        print("Running _refresh_cache_for_city_task...")
        # Manually invoke the refresh task
        _refresh_cache_for_city_task(db, "New York", "events")
        
        print("\nChecking database contents...")
        events = db.query(ExploreEvent).all()
        print(f"Total events in DB: {len(events)}")
        for e in events:
            print(f"- {e.title} (category: {e.category})")
            
    except Exception as e:
        print("CRASHED!")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
