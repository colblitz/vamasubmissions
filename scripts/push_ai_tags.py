#!/usr/bin/env python3
"""
Push AI tag suggestions from a local suggestions.json file to the prod DB.

Connects to prod via SSH (deploy@vama), piping SQL through stdin to
`sudo -u postgres psql`.  Inserts are idempotent:
  ON CONFLICT (post_id, tag) DO NOTHING
so the script is safe to re-run.

Note: suggestions.json uses the Patreon post_id string (e.g. "148871218").
This script resolves those to integer PKs via the local prod DB copy
(vamasubmissions_prod) before inserting.

Usage:
  python push_ai_tags.py                          # uses suggestions.json
  python push_ai_tags.py --input my_file.json
  python push_ai_tags.py --dry-run                # show counts, no writes
  python push_ai_tags.py --local-db <url>         # override local DB URL
  python push_ai_tags.py --ssh-host someother     # override SSH host
"""

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Config defaults
# ---------------------------------------------------------------------------

DEFAULT_INPUT = "suggestions.json"
DEFAULT_LOCAL_DB = "postgresql:///vamasubmissions_prod"
SSH_HOST = "deploy@vama"
REMOTE_PSQL_DB = "vamasubmissions"
BATCH_SIZE = 200  # rows per INSERT statement (conservative for stdin piping)


# ---------------------------------------------------------------------------
# Resolve Patreon post_id strings → integer PKs
# ---------------------------------------------------------------------------

def resolve_post_ids(suggestions: list[dict], local_db_url: str) -> list[dict]:
    """
    Replace the Patreon post_id string in each suggestion with the integer
    posts.id PK, using the local prod DB copy.  Suggestions for post_ids
    that don't exist in the local DB are dropped with a warning.
    """
    patreon_ids = list({s["post_id"] for s in suggestions})

    conn = psycopg2.connect(local_db_url)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT post_id, id FROM posts WHERE post_id = ANY(%s)",
            (patreon_ids,),
        )
        rows = cur.fetchall()
    conn.close()

    id_map = {patreon_id: pk for patreon_id, pk in rows}

    missing = set(patreon_ids) - set(id_map)
    if missing:
        print(f"[warn] {len(missing)} patreon post_ids not found in local DB — "
              f"those suggestions will be skipped.")
        for m in sorted(missing)[:5]:
            print(f"         {m}")
        if len(missing) > 5:
            print(f"         ... and {len(missing) - 5} more")

    resolved = []
    for s in suggestions:
        pk = id_map.get(s["post_id"])
        if pk is not None:
            resolved.append({**s, "post_id": pk})
    return resolved


# ---------------------------------------------------------------------------
# Build SQL
# ---------------------------------------------------------------------------

def build_insert_sql(rows: list[dict]) -> str:
    """
    Build a single INSERT ... VALUES (...), ... ON CONFLICT DO NOTHING
    for a batch of suggestion rows (post_id must already be integer PK).
    """
    def escape(v):
        if v is None:
            return "NULL"
        s = str(v).replace("'", "''")
        return f"'{s}'"

    value_tuples = []
    for r in rows:
        post_id   = int(r["post_id"])
        tag       = escape(r["tag"])
        conf      = float(r["confidence"])
        source    = escape(r["source"])
        model_ver = escape(r.get("model_version"))
        value_tuples.append(f"({post_id}, {tag}, {conf}, {source}, {model_ver})")

    values_sql = ",\n  ".join(value_tuples)
    return (
        "INSERT INTO ai_tag_suggestions "
        "(post_id, tag, confidence, source, model_version)\n"
        f"VALUES\n  {values_sql}\n"
        "ON CONFLICT (post_id, tag) DO NOTHING;"
    )


# ---------------------------------------------------------------------------
# SSH execution
# ---------------------------------------------------------------------------

def run_sql_on_prod(sql: str, ssh_host: str, db: str) -> tuple[int, str, str]:
    """Run a SQL string on prod via SSH, piping through stdin."""
    proc = subprocess.run(
        ["ssh", "-o", "LogLevel=ERROR", ssh_host,
         f"sudo -u postgres psql -d {db} -f -"],
        input=sql.encode(),
        capture_output=True,
    )
    return proc.returncode, proc.stdout.decode(), proc.stderr.decode()


def check_prod_table_exists(ssh_host: str, db: str) -> bool:
    """Return True if ai_tag_suggestions table exists on prod."""
    rc, stdout, stderr = run_sql_on_prod(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_name = 'ai_tag_suggestions');",
        ssh_host, db,
    )
    if rc != 0:
        print(f"[prod] ERROR checking table: {stderr.strip()}", file=sys.stderr)
        return False
    return "t" in stdout


def get_prod_row_count(ssh_host: str, db: str) -> int:
    """Return current row count of ai_tag_suggestions on prod."""
    rc, stdout, _ = run_sql_on_prod(
        "SELECT COUNT(*) FROM ai_tag_suggestions;", ssh_host, db
    )
    if rc != 0:
        return -1
    for line in stdout.splitlines():
        line = line.strip()
        if line.isdigit():
            return int(line)
    return -1


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Push AI tag suggestions JSON to the prod DB via SSH."
    )
    parser.add_argument(
        "--input", default=DEFAULT_INPUT,
        help=f"Path to suggestions JSON file (default: {DEFAULT_INPUT})"
    )
    parser.add_argument(
        "--local-db", default=DEFAULT_LOCAL_DB,
        help=f"Local DB URL for post_id resolution (default: {DEFAULT_LOCAL_DB})"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be inserted, but don't write to prod"
    )
    parser.add_argument(
        "--ssh-host", default=SSH_HOST,
        help=f"SSH host for prod DB (default: {SSH_HOST})"
    )
    parser.add_argument(
        "--db", default=REMOTE_PSQL_DB,
        help=f"Prod DB name (default: {REMOTE_PSQL_DB})"
    )
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # Load suggestions
    # ------------------------------------------------------------------
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[error] Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path) as f:
        suggestions = json.load(f)

    if not suggestions:
        print("[info] No suggestions in file. Nothing to do.")
        sys.exit(0)

    print(f"[input] {len(suggestions)} suggestions from {input_path}")
    by_source = Counter(s["source"] for s in suggestions)
    for source, count in sorted(by_source.items()):
        print(f"         {source}: {count}")
    print(f"         covering {len(set(s['post_id'] for s in suggestions))} posts")

    # ------------------------------------------------------------------
    # Resolve Patreon post_id strings → integer PKs
    # ------------------------------------------------------------------
    print(f"\n[resolve] Looking up integer PKs in {args.local_db} ...")
    suggestions = resolve_post_ids(suggestions, args.local_db)
    print(f"[resolve] {len(suggestions)} suggestions resolved to valid post PKs")

    if not suggestions:
        print("[error] No resolvable suggestions. Aborting.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print("\n[dry-run] Would insert the above. No changes made.")
        sys.exit(0)

    # ------------------------------------------------------------------
    # Verify migration has been applied
    # ------------------------------------------------------------------
    print(f"\n[prod] Checking {args.ssh_host} ...")
    if not check_prod_table_exists(args.ssh_host, args.db):
        print(
            "[prod] ERROR: ai_tag_suggestions table does not exist on prod.\n"
            "       Run the migration first:\n"
            "       ssh deploy@vama 'sudo -u postgres psql -d vamasubmissions -f -' "
            "< backend/alembic/versions/023_add_ai_tag_suggestions.sql",
            file=sys.stderr,
        )
        sys.exit(1)

    before_count = get_prod_row_count(args.ssh_host, args.db)
    print(f"[prod] Existing rows in ai_tag_suggestions: {before_count}")

    # ------------------------------------------------------------------
    # Insert in batches
    # ------------------------------------------------------------------
    total = len(suggestions)
    inserted_batches = 0
    errors = 0

    print(f"\n[push] Inserting {total} rows in batches of {BATCH_SIZE} ...")
    for batch_start in range(0, total, BATCH_SIZE):
        batch = suggestions[batch_start : batch_start + BATCH_SIZE]
        sql = build_insert_sql(batch)

        rc, stdout, stderr = run_sql_on_prod(sql, args.ssh_host, args.db)
        batch_end = min(batch_start + BATCH_SIZE, total)

        if rc != 0:
            print(f"[push] ERROR on batch {batch_start+1}–{batch_end}:\n{stderr.strip()}")
            errors += 1
        else:
            inserted_batches += 1
            inserted_n = "?"
            for line in stdout.splitlines():
                if line.startswith("INSERT"):
                    parts = line.split()
                    if len(parts) == 3:
                        inserted_n = parts[2]
            print(f"[push] {batch_start+1}–{batch_end} → {inserted_n} new rows")

    # ------------------------------------------------------------------
    # Final summary
    # ------------------------------------------------------------------
    after_count = get_prod_row_count(args.ssh_host, args.db)
    net_new = (after_count - before_count) if before_count >= 0 and after_count >= 0 else "?"

    print(f"\n[done] {inserted_batches} batches OK, {errors} errors")
    print(f"[done] Rows before: {before_count}  →  after: {after_count}  (+{net_new} new)")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
