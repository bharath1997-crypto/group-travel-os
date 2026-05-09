import sys
import os
# Add the project root to sys.path so it can find the 'app' folder
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from app.utils.database import SessionLocal
from app.models.explore_content import ExploreContent

def clear_chicago_cache():
    db = SessionLocal()
    try:
        # Clear both spellings just in case
        count = db.query(ExploreContent).filter(
            (ExploreContent.city.ilike('Chicago%')) | (ExploreContent.city.ilike('chiicago%'))
        ).delete(synchronize_session=False)
        db.commit()
        print(f"Success: Cleared {count} cache entries for Chicago/chiicago.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_chicago_cache()
