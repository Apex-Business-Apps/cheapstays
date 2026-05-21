#!/usr/bin/env python3
"""Apply a Supabase migration via the Management API.

Usage:
    python3 supabase/scripts/apply_migration.py <migration_file.sql>

Requires:
    SUPABASE_ACCESS_TOKEN  — personal access token (sbp_...)
    SUPABASE_PROJECT_REF   — project reference ID (default: muqdmvkapsxrsgdkfoxn)
"""
import json, http.client, ssl, sys, os

def apply(sql_file: str) -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    ref   = os.environ.get("SUPABASE_PROJECT_REF", "muqdmvkapsxrsgdkfoxn")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN environment variable is required.")

    with open(sql_file) as f:
        sql = f.read()

    body = json.dumps({"query": sql}).encode()
    ctx  = ssl.create_default_context()
    conn = http.client.HTTPSConnection("api.supabase.com", context=ctx)
    conn.request("POST", f"/v1/projects/{ref}/database/query", body, {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent":    "cheapstays-deploy/1.0",
    })
    resp = conn.getresponse()
    raw  = resp.read().decode()

    if resp.status in (200, 201):
        print(f"[OK] Applied: {sql_file}")
    else:
        print(f"[ERROR {resp.status}] {sql_file}")
        print(raw[:2000])
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 apply_migration.py <file.sql>")
    apply(sys.argv[1])
