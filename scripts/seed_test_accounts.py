#!/usr/bin/env python3
"""
Standalone seed script: 50 test users (@travello-test.com) + group memberships.
Run from project root: python scripts/seed_test_accounts.py
"""
from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

OWNER_USER_ID = "5cdde29e-0e2c-4196-b523-e94bb34b2ee9"

TEST_ACCOUNTS: list[tuple[str, str, str]] = [
    ("Aarav Shah", "aarav.shah", "Mumbai"),
    ("Aditi Verma", "aditi.verma", "Delhi"),
    ("Akash Patel", "akash.patel", "Ahmedabad"),
    ("Ananya Reddy", "ananya.reddy", "Hyderabad"),
    ("Arjun Mehta", "arjun.mehta", "Pune"),
    ("Avni Joshi", "avni.joshi", "Bengaluru"),
    ("Chirag Desai", "chirag.desai", "Surat"),
    ("Deepika Nair", "deepika.nair", "Kochi"),
    ("Dev Sharma", "dev.sharma", "Jaipur"),
    ("Divya Pillai", "divya.pillai", "Chennai"),
    ("Gaurav Bose", "gaurav.bose", "Kolkata"),
    ("Isha Kapoor", "isha.kapoor", "Delhi"),
    ("Jay Malhotra", "jay.malhotra", "Chandigarh"),
    ("Karan Singhania", "karan.singhania", "Lucknow"),
    ("Kavya Menon", "kavya.menon", "Bengaluru"),
    ("Kunal Tiwari", "kunal.tiwari", "Bhopal"),
    ("Lakshmi Iyer", "lakshmi.iyer", "Chennai"),
    ("Manav Gupta", "manav.gupta", "Noida"),
    ("Meera Saxena", "meera.saxena", "Agra"),
    ("Mohit Rawat", "mohit.rawat", "Dehradun"),
    ("Naina Choudhary", "naina.choudhary", "Jodhpur"),
    ("Nikhil Agarwal", "nikhil.agarwal", "Varanasi"),
    ("Nisha Trivedi", "nisha.trivedi", "Vadodara"),
    ("Om Prakash", "om.prakash", "Patna"),
    ("Pooja Rajan", "pooja.rajan", "Mysuru"),
    ("Pranav Kulkarni", "pranav.kulkarni", "Pune"),
    ("Priya Sharma", "priya.sharma", "Mumbai"),
    ("Rahul Dubey", "rahul.dubey", "Kanpur"),
    ("Raj Anand", "raj.anand", "Bengaluru"),
    ("Rakesh Pandey", "rakesh.pandey", "Allahabad"),
    ("Riya Bhatt", "riya.bhatt", "Ahmedabad"),
    ("Rohit Shetty", "rohit.shetty", "Mangaluru"),
    ("Saanvi Deshpande", "saanvi.deshpande", "Nagpur"),
    ("Sagar Wagh", "sagar.wagh", "Nashik"),
    ("Sakshi Mittal", "sakshi.mittal", "Gurugram"),
    ("Sameer Qureshi", "sameer.qureshi", "Hyderabad"),
    ("Sanya Oberoi", "sanya.oberoi", "Amritsar"),
    ("Shruti Bhandari", "shruti.bhandari", "Indore"),
    ("Siddharth Rao", "siddharth.rao", "Vizag"),
    ("Simran Kaur", "simran.kaur", "Ludhiana"),
    ("Sneha Patil", "sneha.patil", "Kolhapur"),
    ("Suresh Kumar", "suresh.kumar", "Coimbatore"),
    ("Tanya Bajaj", "tanya.bajaj", "Delhi"),
    ("Tejas Naik", "tejas.naik", "Goa"),
    ("Uday Bhosle", "uday.bhosle", "Aurangabad"),
    ("Vandana Singh", "vandana.singh", "Meerut"),
    ("Varun Chopra", "varun.chopra", "Mumbai"),
    ("Vidya Krishnan", "vidya.krishnan", "Thiruvananthapuram"),
    ("Vikram Jain", "vikram.jain", "Rajkot"),
    ("Yash Thakur", "yash.thakur", "Shimla"),
]


def _get_hash_password():
    try:
        from app.utils.auth import hash_password as _hp

        return _hp
    except ImportError:
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        def hash_password(p: str) -> str:
            return pwd_context.hash(p)

        return hash_password


def _sync_database_url(raw: str) -> str:
    u = raw.replace("postgresql+asyncpg://", "postgresql://")
    u = u.replace("postgresql+aiopg://", "postgresql://")
    return u


def _has_column(conn, table_name: str, column_name: str) -> bool:
    from sqlalchemy import text

    r = conn.execute(
        text(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :t
              AND column_name = :c
            """
        ),
        {"t": table_name, "c": column_name},
    )
    return r.scalar() is not None


def _build_users_insert_sql(
    *,
    include_username: bool,
    include_is_verified: bool,
) -> str:
    cols = [
        "id",
        "email",
        "hashed_password",
        "full_name",
        "is_active",
        "created_at",
        "updated_at",
    ]
    if include_username:
        cols.insert(4, "username")
    if include_is_verified:
        idx = cols.index("is_active")
        cols.insert(idx, "is_verified")

    parts: list[str] = []
    for c in cols:
        if c == "id":
            parts.append("CAST(:id AS uuid)")
        elif c == "is_active":
            parts.append("true")
        elif c == "is_verified":
            parts.append("true")
        else:
            parts.append(f":{c}")

    col_sql = ", ".join(cols)
    val_sql = ", ".join(parts)
    return f"INSERT INTO users ({col_sql}) VALUES ({val_sql})"


def main() -> None:
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

    hash_password = _get_hash_password()
    password_hash = hash_password("TestPass@123")

    try:
        from config import settings
    except Exception as exc:
        print(f"Could not load settings: {exc}")
        sys.exit(1)

    db_url = _sync_database_url(settings.DATABASE_URL)

    try:
        engine = create_engine(db_url, pool_pre_ping=True)
    except Exception as exc:
        print(
            "Could not connect to database. Check your .env file "
            "and make sure PostgreSQL is running."
        )
        print(f"Detail: {exc}")
        sys.exit(1)

    created_count = 0
    skipped_count = 0
    groups_joined = 0
    created_user_ids: list[str] = []

    try:
        with engine.connect() as raw_conn:
            include_username = _has_column(raw_conn, "users", "username")
            include_is_verified = _has_column(raw_conn, "users", "is_verified")
            gm_has_joined_at = _has_column(raw_conn, "group_members", "joined_at")

        insert_sql = _build_users_insert_sql(
            include_username=include_username,
            include_is_verified=include_is_verified,
        )

        with engine.begin() as conn:
            now = datetime.now(timezone.utc)

            for full_name, username, _city in TEST_ACCOUNTS:
                email = f"{username}@travello-test.com"
                exists = conn.execute(
                    text("SELECT 1 FROM users WHERE email = :email LIMIT 1"),
                    {"email": email},
                ).scalar()
                if exists:
                    print(f"SKIP (already exists): {full_name} ({email})")
                    skipped_count += 1
                    continue

                user_id = str(uuid.uuid4())
                params: dict = {
                    "id": user_id,
                    "email": email,
                    "hashed_password": password_hash,
                    "full_name": full_name,
                    "created_at": now,
                    "updated_at": now,
                }
                if include_username:
                    params["username"] = username

                row_ok = False
                try:
                    with conn.begin_nested():
                        conn.execute(text(insert_sql), params)
                    row_ok = True
                except ProgrammingError as pe:
                    msg = str(pe.orig) if hasattr(pe, "orig") else str(pe)
                    lowered = msg.lower()
                    if "undefinedcolumn" in lowered or "does not exist" in lowered:
                        print(
                            f"UndefinedColumn — adjusting INSERT and retrying once: {msg}"
                        )
                        retry_uv = include_is_verified
                        retry_un = include_username
                        if "is_verified" in lowered:
                            retry_uv = False
                        if "username" in lowered:
                            retry_un = False
                        if retry_uv == include_is_verified and retry_un == include_username:
                            raise
                        include_is_verified = retry_uv
                        include_username = retry_un
                        insert_sql = _build_users_insert_sql(
                            include_username=include_username,
                            include_is_verified=include_is_verified,
                        )
                        retry_params = dict(params)
                        if not include_username:
                            retry_params.pop("username", None)
                        with conn.begin_nested():
                            conn.execute(text(insert_sql), retry_params)
                        row_ok = True
                    else:
                        raise
                except IntegrityError:
                    print(f"SKIP (duplicate): {full_name} ({email})")
                    skipped_count += 1
                    continue

                if not row_ok:
                    continue

                created_count += 1
                created_user_ids.append(user_id)
                print(f"✓ Created: {full_name} ({email})")

            group_rows = conn.execute(
                text(
                    """
                    SELECT g.id, g.name FROM groups g
                    JOIN group_members gm ON gm.group_id = g.id
                    WHERE gm.user_id = CAST(:oid AS uuid)
                    """
                ),
                {"oid": OWNER_USER_ID},
            ).fetchall()

            for gid, gname in group_rows:
                gid_str = str(gid)
                for uid in created_user_ids:
                    already = conn.execute(
                        text(
                            """
                            SELECT 1 FROM group_members
                            WHERE group_id = CAST(:g AS uuid) AND user_id = CAST(:u AS uuid)
                            LIMIT 1
                            """
                        ),
                        {"g": gid_str, "u": uid},
                    ).scalar()
                    if already:
                        continue

                    gm_id = str(uuid.uuid4())
                    if gm_has_joined_at:
                        conn.execute(
                            text(
                                """
                                INSERT INTO group_members (id, group_id, user_id, role, joined_at)
                                VALUES (
                                    CAST(:id AS uuid),
                                    CAST(:gid AS uuid),
                                    CAST(:uid AS uuid),
                                    CAST(:role AS member_role),
                                    :joined_at
                                )
                                """
                            ),
                            {
                                "id": gm_id,
                                "gid": gid_str,
                                "uid": uid,
                                "role": "member",
                                "joined_at": datetime.now(timezone.utc),
                            },
                        )
                    else:
                        conn.execute(
                            text(
                                """
                                INSERT INTO group_members (id, group_id, user_id, role)
                                VALUES (
                                    CAST(:id AS uuid),
                                    CAST(:gid AS uuid),
                                    CAST(:uid AS uuid),
                                    CAST(:role AS member_role)
                                )
                                """
                            ),
                            {
                                "id": gm_id,
                                "gid": gid_str,
                                "uid": uid,
                                "role": "member",
                            },
                        )
                    groups_joined += 1

            if group_rows:
                print(
                    f"Added memberships for {len(created_user_ids)} user(s) "
                    f"across {len(group_rows)} group(s) owned by member {OWNER_USER_ID}."
                )

        with engine.connect() as vconn:
            total_test = vconn.execute(
                text(
                    """
                    SELECT COUNT(*) AS c FROM users
                    WHERE email LIKE '%@travello-test.com'
                    """
                )
            ).scalar()
            print(
                f"Verification: {int(total_test or 0)} test accounts in database"
            )

            sample = vconn.execute(
                text(
                    """
                    SELECT full_name, email FROM users
                    WHERE email LIKE '%@travello-test.com'
                    ORDER BY full_name
                    LIMIT 5
                    """
                )
            ).fetchall()

            print("Sample accounts:")
            for fn, em in sample:
                print(f"  - {fn}: {em}")

    except OperationalError as exc:
        print(
            "Could not connect to database. Check your .env file "
            "and make sure PostgreSQL is running."
        )
        print(str(exc))
        sys.exit(1)
    except Exception as exc:
        print(f"Seed failed: {exc}")
        raise

    print("=" * 50)
    print("SEED COMPLETE")
    print("=" * 50)
    print(f"Created : {created_count} accounts")
    print(f"Skipped : {skipped_count} (already existed)")
    print(f"Groups  : joined {groups_joined} group(s)")
    print("")
    print("Login credentials for all test accounts:")
    print("  Password : TestPass@123")
    print("  Email    : firstname.lastname@travello-test.com")
    print("")
    print("Examples:")
    print("  arjun.mehta@travello-test.com")
    print("  priya.sharma@travello-test.com")
    print("  suresh.kumar@travello-test.com")
    print("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)
