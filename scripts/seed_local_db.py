#!/usr/bin/env python3
"""
Seed PostgreSQL: Bharath-owned groups + memberships for travello-test users.

Reads DATABASE_URL from .env via python-dotenv (postgresql:// or postgresql+asyncpg://).
Falls back to POSTGRES_PASSWORD / PGPASSWORD and local defaults if DATABASE_URL is missing.

Run from project root: python scripts/seed_local_db.py
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent

OWNER_EMAIL = "nidumolubharath230@gmail.com"

GROUP_SEEDS: list[tuple[str, str, str]] = [
    ("Kashmir Crew", "Kashmir valley trip", "KASH01"),
    ("Goa Gang", "Goa beach trip crew", "GOAG26"),
    ("Manali Winter", "Mountain trek group", "MANA01"),
    ("Thailand Crew", "Bangkok adventure", "THAI01"),
    ("Robotics Offsite", "Company team offsite", "ROBO01"),
]


def load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
    except ImportError:
        env_path = ROOT / ".env"
        if not env_path.is_file():
            return
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


def parse_db_settings() -> dict[str, str | int]:
    """
    Build psycopg2 connect kwargs from DATABASE_URL or POSTGRES_* fallbacks.
    """
    load_env()
    raw_url = (os.environ.get("DATABASE_URL") or "").strip()
    if raw_url:
        url = raw_url
        for prefix in (
            "postgresql+asyncpg://",
            "postgresql+psycopg2://",
            "postgres://",
        ):
            if url.startswith(prefix):
                url = "postgresql://" + url[len(prefix) :]
                break
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        user = parsed.username or "postgres"
        password = unquote(parsed.password) if parsed.password else ""
        dbname = (parsed.path or "/postgres").strip("/") or "postgres"
        return {
            "host": host,
            "port": port,
            "dbname": dbname,
            "user": user,
            "password": password,
        }

    password = (
        os.environ.get("POSTGRES_PASSWORD")
        or os.environ.get("PGPASSWORD")
        or ""
    )
    return {
        "host": os.environ.get("POSTGRES_HOST", "localhost"),
        "port": int(os.environ.get("POSTGRES_PORT", "5432")),
        "dbname": os.environ.get("POSTGRES_DB", "group_travel_os"),
        "user": os.environ.get("POSTGRES_USER", "postgres"),
        "password": password,
    }


def connect():
    import psycopg2
    from psycopg2 import OperationalError

    cfg = parse_db_settings()
    kwargs = {
        "host": cfg["host"],
        "port": cfg["port"],
        "dbname": cfg["dbname"],
        "user": cfg["user"],
        "connect_timeout": 10,
    }
    pwd = cfg.get("password")
    if pwd:
        kwargs["password"] = pwd

    try:
        conn = psycopg2.connect(**kwargs)
        conn.autocommit = False
        print(
            f"Connected: {cfg['user']}@{cfg['host']}:{cfg['port']}/{cfg['dbname']}"
        )
        return conn
    except OperationalError as e:
        print("Could not connect. Set DATABASE_URL or POSTGRES_* in .env")
        print(f"Detail: {e}")
        sys.exit(1)


def _fetch_columns(cur, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return {r[0] for r in cur.fetchall()}


def main() -> None:
    t0 = time.perf_counter()
    try:
        import psycopg2
        from psycopg2 import errors
        from psycopg2.extras import execute_values
    except ImportError as e:
        print(f"psycopg2 is required: {e}")
        sys.exit(1)

    memberships_added = 0
    conn = None

    try:
        conn = connect()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM users WHERE email = %s",
                (OWNER_EMAIL,),
            )
            row = cur.fetchone()
            if not row:
                print(f"No user found with email {OWNER_EMAIL!r}.")
                sys.exit(1)
            bharath_id = row[0]
            print(f"Owner user id: {bharath_id}")

            gcols = _fetch_columns(cur, "groups")
            if not gcols:
                print("Table 'groups' not found or has no columns in public schema.")
                sys.exit(1)

            gmcols = _fetch_columns(cur, "group_members")

            has_updated_at = "updated_at" in gcols
            has_is_accepting = "is_accepting_members" in gcols
            gm_has_joined_at = "joined_at" in gmcols

            now = datetime.now(timezone.utc)

            for name, description, invite_code in GROUP_SEEDS:
                cur.execute(
                    "SELECT id FROM groups WHERE invite_code = %s",
                    (invite_code,),
                )
                if cur.fetchone():
                    print(f"SKIP group (invite exists): {name} [{invite_code}]")
                    continue

                gid = uuid.uuid4()
                cols = [
                    "id",
                    "name",
                    "description",
                    "created_by",
                    "invite_code",
                    "created_at",
                ]
                vals: list = [
                    str(gid),
                    name,
                    description,
                    str(bharath_id),
                    invite_code,
                    now,
                ]
                if has_is_accepting:
                    cols.insert(-1, "is_accepting_members")
                    vals.insert(-1, True)
                if has_updated_at:
                    cols.append("updated_at")
                    vals.append(now)

                col_sql = ", ".join(cols)
                # UUID columns must be passed as str for psycopg2; cast in SQL.
                ph_parts: list[str] = []
                for c in cols:
                    if c in ("id", "created_by"):
                        ph_parts.append("%s::uuid")
                    elif c == "created_at" or c == "updated_at":
                        ph_parts.append("%s::timestamptz")
                    elif c == "is_accepting_members":
                        ph_parts.append("%s")
                    else:
                        ph_parts.append("%s")
                placeholders = ", ".join(ph_parts)
                cur.execute(
                    f"INSERT INTO groups ({col_sql}) VALUES ({placeholders})",
                    vals,
                )
                print(f"[ok] Created group: {name} ({invite_code})")

            cur.execute(
                """
                SELECT id, name, invite_code FROM groups
                WHERE created_by = %s
                ORDER BY invite_code
                """,
                (bharath_id,),
            )
            bharath_groups = cur.fetchall()
            if not bharath_groups:
                print("No groups owned by this user; nothing to membership-seed.")
                conn.commit()
                return

            for gid, gname, inv in bharath_groups:
                cur.execute(
                    """
                    SELECT role::text FROM group_members
                    WHERE group_id = %s AND user_id = %s
                    """,
                    (gid, bharath_id),
                )
                r = cur.fetchone()
                label = f"{gname} [{inv}]"
                if r is None:
                    if gm_has_joined_at:
                        cur.execute(
                            """
                            INSERT INTO group_members
                            (id, group_id, user_id, role, joined_at)
                            VALUES (%s::uuid, %s::uuid, %s::uuid, %s::member_role, %s)
                            """,
                            (
                                str(uuid.uuid4()),
                                str(gid),
                                str(bharath_id),
                                "admin",
                                now,
                            ),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO group_members
                            (id, group_id, user_id, role)
                            VALUES (%s::uuid, %s::uuid, %s::uuid, %s::member_role)
                            """,
                            (
                                str(uuid.uuid4()),
                                str(gid),
                                str(bharath_id),
                                "admin",
                            ),
                        )
                    print(f"  Added Bharath as admin: {label}")
                elif r[0] != "admin":
                    cur.execute(
                        """
                        UPDATE group_members
                        SET role = 'admin'::member_role
                        WHERE group_id = %s AND user_id = %s
                        """,
                        (gid, bharath_id),
                    )
                    print(f"  Promoted Bharath to admin: {label}")
                else:
                    print(f"  Bharath already admin: {label}")

            cur.execute(
                """
                SELECT id, full_name FROM users
                WHERE email LIKE %s
                ORDER BY full_name
                """,
                ("%travello-test.com",),
            )
            test_users = cur.fetchall()
            if len(test_users) != 50:
                print(
                    f"Warning: expected 50 travello-test users, found {len(test_users)}."
                )

            counts_before: dict = {}
            for gid, _name, _inv in bharath_groups:
                cur.execute(
                    "SELECT COUNT(*) FROM group_members WHERE group_id = %s",
                    (gid,),
                )
                counts_before[gid] = cur.fetchone()[0]

            batch_cols = ["id", "group_id", "user_id", "role"]
            if gm_has_joined_at:
                batch_cols.append("joined_at")

            for gid, gname, inv in bharath_groups:
                tuples = []
                for uid, _fn in test_users:
                    if gm_has_joined_at:
                        tuples.append(
                            (str(uuid.uuid4()), str(gid), str(uid), "member", now)
                        )
                    else:
                        tuples.append((str(uuid.uuid4()), str(gid), str(uid), "member"))

                if not tuples:
                    continue

                if gm_has_joined_at:
                    template = "(%s::uuid, %s::uuid, %s::uuid, %s::member_role, %s::timestamptz)"
                else:
                    template = "(%s::uuid, %s::uuid, %s::uuid, %s::member_role)"

                sql = f"""
                    INSERT INTO group_members ({", ".join(batch_cols)})
                    VALUES %s
                    ON CONFLICT (group_id, user_id) DO NOTHING
                """
                execute_values(cur, sql, tuples, template=template, page_size=500)
                print(f"  Bulk members for {gname} [{inv}]: {len(tuples)} rows")

            for gid, _n, _i in bharath_groups:
                cur.execute(
                    "SELECT COUNT(*) FROM group_members WHERE group_id = %s",
                    (gid,),
                )
                after = cur.fetchone()[0]
                memberships_added += after - counts_before[gid]

            conn.commit()

            print("")
            print("Summary - invite | Group name | Member count")
            print("-" * 60)
            for gid, gname, inv in bharath_groups:
                cur.execute(
                    "SELECT COUNT(*) FROM group_members WHERE group_id = %s",
                    (gid,),
                )
                n = cur.fetchone()[0]
                print(f"{inv:8} | {gname:22} | {n}")
            print("-" * 60)
            print(f"Total memberships added (delta): {memberships_added}")
            print(f"Time taken: {time.perf_counter() - t0:.2f}s")

            print("")
            print("Verification - per group id (Bharath as creator):")
            cur.execute(
                """
                SELECT g.invite_code, g.name, COUNT(gm.user_id) AS members
                FROM groups g
                JOIN group_members gm ON gm.group_id = g.id
                JOIN users u ON u.id = g.created_by
                WHERE u.email = %s
                GROUP BY g.id, g.invite_code, g.name
                ORDER BY members DESC, g.invite_code
                """,
                (OWNER_EMAIL,),
            )
            for inv, gname, mcount in cur.fetchall():
                print(f"  [{inv}] {gname}: {mcount} members")

    except errors.UniqueViolation as e:
        print(f"Unique constraint violation: {e}")
        if conn is not None:
            conn.rollback()
        sys.exit(1)
    except Exception as e:
        print(f"Seed failed: {e}")
        if conn is not None:
            conn.rollback()
        raise
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)
