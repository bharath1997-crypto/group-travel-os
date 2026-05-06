import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.utils.database import SessionLocal
from app.models.explore_event import ExploreEvent
from sqlalchemy import delete

def main():
    print("Clearing database cache to fetch new ticket links...")
    db = SessionLocal()
    try:
        db.execute(delete(ExploreEvent))
        db.commit()
        print("Cache cleared successfully!")
    except Exception as e:
        print(f"Failed to clear cache: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
