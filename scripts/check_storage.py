import psycopg2

DB_URL = "postgresql://postgres.osrluyfalgtqwbkewpjc:d2PvV5HoK1d@aws-1-us-west-2.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

# 1. Total database size
cur.execute("SELECT pg_size_pretty(pg_database_size(current_database())), pg_database_size(current_database())")
db_pretty, db_bytes = cur.fetchone()

# 2. Per-table sizes (top 30)
cur.execute("""
SELECT
    s.schemaname,
    s.relname                                                             AS tablename,
    pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||s.relname)) AS total_size,
    pg_size_pretty(pg_relation_size(s.schemaname||'.'||s.relname))       AS table_size,
    pg_size_pretty(pg_indexes_size(s.schemaname||'.'||s.relname))        AS index_size,
    pg_total_relation_size(s.schemaname||'.'||s.relname)                 AS raw_bytes,
    s.n_live_tup                                                          AS live_rows
FROM pg_stat_user_tables s
ORDER BY raw_bytes DESC
LIMIT 30
""")
tables = cur.fetchall()

# 3. Schema-level rollup
cur.execute("""
SELECT schemaname,
       pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||relname))) AS schema_size,
       SUM(pg_total_relation_size(schemaname||'.'||relname))                 AS raw_bytes
FROM pg_stat_user_tables
GROUP BY schemaname
ORDER BY raw_bytes DESC
""")
schemas = cur.fetchall()

# 4. Table vs index split
cur.execute("""
SELECT
    pg_size_pretty(SUM(pg_indexes_size(schemaname||'.'||relname)))  AS total_index_size,
    pg_size_pretty(SUM(pg_relation_size(schemaname||'.'||relname)))  AS total_table_size,
    SUM(pg_indexes_size(schemaname||'.'||relname))                   AS idx_bytes,
    SUM(pg_relation_size(schemaname||'.'||relname))                  AS tbl_bytes
FROM pg_stat_user_tables
""")
idx_summary = cur.fetchone()

# 5. Largest indexes
cur.execute("""
SELECT i.indexrelname, i.relname AS tablename,
       pg_size_pretty(pg_relation_size(i.indexrelid)) AS size,
       pg_relation_size(i.indexrelid)                 AS raw
FROM pg_stat_user_indexes i
ORDER BY raw DESC
LIMIT 12
""")
top_indexes = cur.fetchall()

# 6. Total user table count
cur.execute("SELECT COUNT(*) FROM pg_stat_user_tables")
table_count = cur.fetchone()[0]

cur.close()
conn.close()

# ── Render report ─────────────────────────────────────────────────────────────
QUOTA_GB = 8
QUOTA    = QUOTA_GB * 1024**3
pct      = (db_bytes / QUOTA) * 100
free_gb  = (QUOTA - db_bytes) / 1024**3
used_mb  = db_bytes / 1024**2
bar_fill = int(pct / 2)
bar      = "#" * bar_fill + "-" * (50 - bar_fill)

W = 74
print()
print("=" * W)
print("  ROVVY - SUPABASE POSTGRES STORAGE REPORT")
print("=" * W)
print()
print(f"  Plan quota      :  {QUOTA_GB:.2f} GB   (8,192.00 MB)")
print(f"  Used            :  {db_pretty:<12}  ({used_mb:,.2f} MB  /  {db_bytes:,} bytes)")
print(f"  Free remaining  :  {free_gb:.3f} GB   ({(QUOTA - db_bytes)/1024**2:,.2f} MB)")
print(f"  Utilisation     :  {pct:.4f}%")
print(f"  Total tables    :  {table_count}")
print()
print(f"  [{bar}] {pct:.2f}%")
print()
print(f"  +-- Table data  :  {idx_summary[1]}")
print(f"  +-- Index data  :  {idx_summary[0]}")

print()
print("─" * W)
print("  SCHEMA BREAKDOWN")
print("─" * W)
for s in schemas:
    schema, sz, rb = s
    pct_s = (rb / QUOTA) * 100
    print(f"  {schema:<35}  {sz:>10}   ({pct_s:.3f}% of quota)")

print()
print("─" * W)
print(f"  TOP {len(tables)} TABLES  (by total on-disk size)")
print("─" * W)
print(f"  {'Table':<36} {'Total':>10}  {'Data':>9}  {'Indexes':>9}  {'Live Rows':>10}")
print(f"  {'-'*36} {'-'*10}  {'-'*9}  {'-'*9}  {'-'*10}")
for t in tables:
    schema, tbl, total, data, idx, raw, rows = t
    label = tbl if len(tbl) <= 36 else tbl[:33] + "..."
    print(f"  {label:<36} {total:>10}  {data:>9}  {idx:>9}  {rows:>10,}")

print()
print("─" * W)
print("  TOP 12 INDEXES BY SIZE")
print("─" * W)
print(f"  {'Index':<44} {'Table':<20} {'Size':>8}")
print(f"  {'-'*44} {'-'*20} {'-'*8}")
for i in top_indexes:
    iname, tname, sz, _ = i
    short_i = iname if len(iname) <= 44 else iname[:41] + "..."
    print(f"  {short_i:<44} {tname:<20} {sz:>8}")

print()
print("─" * W)
if pct > 80:
    status = "WARNING: Over 80% quota used - schedule cleanup or upgrade plan."
    icon = "!!!"
elif pct > 60:
    status = "CAUTION: Over 60% quota used - monitor growth closely."
    icon = " ! "
elif pct > 40:
    status = "MODERATE: Growing steadily - plan for future expansion."
    icon = " ~ "
else:
    status = "HEALTHY: Well within quota - no action needed."
    icon = " OK"
print(f"  [{icon}]  {status}")
print("=" * W)
print()
