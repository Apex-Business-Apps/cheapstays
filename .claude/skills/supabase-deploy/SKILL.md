---
name: supabase-deploy
description: Deploy Supabase edge functions or push database migrations to the CheapStays production project. Use whenever the user asks to deploy a function, push a migration, ship an edge function, run `supabase functions deploy`, run `supabase db push`, or promote local supabase/ changes to production. Also use when the user needs to invoke a service-role-only edge function from the CLI and needs the right auth token.
---

# supabase-deploy

Deploys code in `supabase/functions/` and migrations in `supabase/migrations/` to the CheapStays production Supabase project.

## Why this skill exists

The developer's `supabase` CLI is logged in as a personal account (`markme.bluecircuit@gmail.com`) that only has access to their own sandbox project. The CheapStays production project belongs to a different org, and the CLI's stored session returns **`403: Your account does not have the necessary privileges`** on any deploy attempt.

The workaround — proven working on 2026-08-19 — is to override the CLI session with a personal access token that *does* have access to the org, stored in `.env` under the non-standard key `ACCESS_TOKEN`. Every deploy must pass this token via `SUPABASE_ACCESS_TOKEN` in the environment.

## Constants

- **Project ref:** `muqdmvkapsxrsgdkfoxn`
- **Project URL:** `https://muqdmvkapsxrsgdkfoxn.supabase.co`
- **Token source:** `ACCESS_TOKEN` variable in the repo's `.env` file (never printed; never committed)
- **Dashboard:** `https://supabase.com/dashboard/project/muqdmvkapsxrsgdkfoxn`

## Preflight

1. Confirm the working directory is the repo root (`.env` and `supabase/` must be siblings).
2. Confirm `.env` contains an `ACCESS_TOKEN=...` line. If missing, stop and ask the user for a personal access token (Dashboard → Account → Access Tokens).
3. Confirm the target file(s) exist under `supabase/functions/<name>/index.ts` or `supabase/migrations/*.sql`.
4. Docker is **not required** — the CLI falls back to API bundling. The `WARNING: Docker is not running` line is safe to ignore.

## Deploy a single edge function

```bash
set -a; source .env; set +a
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase functions deploy <function-name> --project-ref muqdmvkapsxrsgdkfoxn
```

Success looks like:
```
Uploading asset (<function-name>): supabase/functions/<function-name>/index.ts
Uploading asset (<function-name>): supabase/functions/_shared/...
{"project_ref":"muqdmvkapsxrsgdkfoxn","functions":["<function-name>"],"message":"Deployed Functions."}
```

If the response is `403 privileges`, the token in `.env` doesn't have access — do not retry with the same token; ask the user for one that does.

## Deploy every changed function at once

```bash
set -a; source .env; set +a
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase functions deploy --project-ref muqdmvkapsxrsgdkfoxn
```
This deploys every function under `supabase/functions/` — use only when the user explicitly wants a bulk push.

## Push database migrations

`supabase db push` applies every migration in `supabase/migrations/` that hasn't yet been recorded in the remote `schema_migrations` table. It is **not idempotent on data** — a migration that mutates rows will run once and its effects are permanent.

```bash
set -a; source .env; set +a
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase db push --project-ref muqdmvkapsxrsgdkfoxn
```

Before running:
- Confirm with the user that they want to push. Migrations are hard to reverse — they may need to write a corrective migration if something goes wrong.
- If there are local uncommitted edits to a migration file that has already been applied on prod (visible in `git status`), warn the user: editing an already-applied migration in place has no effect on prod. They need a new migration file.
- Prefer `supabase db diff` or `supabase migration list --project-ref muqdmvkapsxrsgdkfoxn` first to preview what will run.

## Verify a deploy

After deploying an edge function:
1. Show the invocation URL: `https://muqdmvkapsxrsgdkfoxn.supabase.co/functions/v1/<function-name>`
2. If the function is admin-only (checks `has_role`), suggest testing via the Dashboard's Invoke tab with an admin user's JWT, not the service-role key.
3. If the function is service-role-only (webhooks, internal jobs), suggest testing via the Dashboard's Invoke tab which signs automatically.

For migrations, suggest running `supabase migration list --project-ref muqdmvkapsxrsgdkfoxn` and checking the most recent entry is marked as applied.

## Safety rules

- **Never print `$ACCESS_TOKEN` or `$SUPABASE_ACCESS_TOKEN` in output.** If you need to confirm the token is loaded, print only whether the variable is non-empty.
- **Never commit `.env`** — it is intentionally in `.gitignore`. If asked to commit files, exclude `.env` explicitly.
- **Never run `supabase db reset` against the production project.** It drops the database. Only ever use it against a local sandbox.
- For destructive operations (`db reset`, `db push` when the diff includes `DROP`), pause and get explicit confirmation from the user first — quote back the specific destructive statements so they know what's about to run.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `403 Your account does not have the necessary privileges` | CLI is using its own stored session, not `$SUPABASE_ACCESS_TOKEN`. Usually means the env var wasn't exported before the command. | Prefix the command with `SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"` on the same line, or run `export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"` first. |
| `WARNING: Docker is not running` | CLI prefers Docker for bundling but is falling back to API. | Ignore — the deploy still succeeds via the API path. |
| `Error: local config differs from remote` on `db push` | Someone else pushed migrations from another machine. | `git pull`, review the new migrations, then retry. |
| Deploy succeeds but the function still 401s when the app calls it | The function requires an env secret (e.g. `SUPABASE_SERVICE_ROLE_KEY`) that's set on the project, or the caller isn't sending the expected auth header. | Check Dashboard → Functions → `<name>` → Secrets, and re-read the function's auth guard. |
