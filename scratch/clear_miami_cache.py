from app.utils.database import SessionLocal
from app.models.explore_content import ExploreContent

def clear_miami_cache():
    db = SessionLocal()
    try:
        count = db.query(ExploreContent).filter(ExploreContent.city.ilike('Miami%')).delete(synchronize_session=False)
        db.commit()
        print(f"Success: Cleared {count} cache entries for Miami.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_miami_cache()
