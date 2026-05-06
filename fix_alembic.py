from sqlalchemy import text
from app.utils.database import SessionLocal

def fix_alembic():
    db = SessionLocal()
    try:
        # First check what is in alembic_version
        result = db.execute(text("SELECT version_num FROM alembic_version")).fetchone()
        if result:
            print(f"Current version in DB is: {result[0]}")
            # Update it to the latest local version
            db.execute(text("UPDATE alembic_version SET version_num = 'e3f4a5b6c7d8'"))
            db.commit()
            print("Successfully updated alembic_version to 'e3f4a5b6c7d8'")
        else:
            print("alembic_version table is empty.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_alembic()
