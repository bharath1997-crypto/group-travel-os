"""Quick check: places table row count and disk size."""
from sqlalchemy import text

from app.db.session import SessionLocal

db = SessionLocal()
rows = db.execute(text("SELECT COUNT(*) FROM places")).scalar()
size = db.execute(
    text("SELECT pg_size_pretty(pg_total_relation_size('places'))")
).scalar()
latest = db.execute(text("SELECT MAX(enriched_at) FROM places")).scalar()
cats = db.execute(
    text(
        "SELECT category, COUNT(*) AS n FROM places "
        "GROUP BY category ORDER BY n DESC LIMIT 10"
    )
).all()

print(f"rows: {rows}")
print(f"size: {size}")
print(f"latest enriched_at: {latest}")
print("top categories:")
for category, count in cats:
    print(f"  {category}: {count}")
