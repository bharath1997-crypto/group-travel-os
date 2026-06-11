"""
tests/test_experience_purge.py — Tests for the experience TTL purge job
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, delete

from app.models.unified_experience import UnifiedExperience
from app.jobs.experience_purge import purge_expired_experiences, run_experience_purge
from app.utils.database import SessionLocal


def test_experience_purge_job():
    """
    Tests experience purge job:
    1. Inserts 5 past experiences (start_datetime < now - 2 days).
    2. Inserts 5 future experiences (start_datetime >= now - 2 days).
    3. Runs purge.
    4. Asserts only future events remain.
    5. Cleans up test experiences.
    """
    db = SessionLocal()

    # Generate unique test identifiers to avoid interference with other data
    test_run_id = f"test-purge-{uuid.uuid4().hex[:8]}"

    past_ids = []
    future_ids = []

    now = datetime.utcnow()

    # Past experiences: we want start_datetime < now - 2 days.
    # Set to 3 days ago.
    for i in range(5):
        past_id = uuid.uuid4()
        past_ids.append(past_id)
        db.add(
            UnifiedExperience(
                id=past_id,
                title=f"Past Experience {i} {test_run_id}",
                canonical_title=f"Past Experience {i} {test_run_id}",
                normalized_title=f"past experience {i} {test_run_id}",
                start_datetime=now - timedelta(days=3),
                dedup_hash=f"hash-past-{i}-{test_run_id}",
            )
        )

    # Future experiences: we want start_datetime >= now - 2 days.
    # Set to 1 day from now.
    for i in range(5):
        future_id = uuid.uuid4()
        future_ids.append(future_id)
        db.add(
            UnifiedExperience(
                id=future_id,
                title=f"Future Experience {i} {test_run_id}",
                canonical_title=f"Future Experience {i} {test_run_id}",
                normalized_title=f"future experience {i} {test_run_id}",
                start_datetime=now + timedelta(days=1),
                dedup_hash=f"hash-future-{i}-{test_run_id}",
            )
        )

    db.commit()

    try:
        # Verify that all 10 were inserted
        stmt = select(UnifiedExperience).where(
            UnifiedExperience.id.in_(past_ids + future_ids)
        )
        inserted_records = db.scalars(stmt).all()
        assert len(inserted_records) == 10

        # Run the purge function
        deleted_count = purge_expired_experiences(db)
        db.commit()

        assert deleted_count >= 5

        # Query past experiences: they should be deleted
        stmt_past = select(UnifiedExperience).where(UnifiedExperience.id.in_(past_ids))
        remaining_past = db.scalars(stmt_past).all()
        assert len(remaining_past) == 0

        # Query future experiences: they should still exist
        stmt_future = select(UnifiedExperience).where(UnifiedExperience.id.in_(future_ids))
        remaining_future = db.scalars(stmt_future).all()
        assert len(remaining_future) == 5

    finally:
        # Clean up any remaining test records
        db.execute(
            delete(UnifiedExperience).where(
                UnifiedExperience.id.in_(past_ids + future_ids)
            )
        )
        db.commit()
        db.close()


def test_run_experience_purge_wrapper():
    """
    Smoke test for the scheduler wrapper to make sure it runs and returns an int.
    """
    result = run_experience_purge()
    assert isinstance(result, int)
