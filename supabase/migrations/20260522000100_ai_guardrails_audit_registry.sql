create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  surface text not null,
  decision text not null check (decision in ('allowed', 'blocked', 'review_required')),
  actor_id uuid null references auth.users(id) on delete set null,
  prompt_version text not null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.github_command_registry (
  id text primary key,
  created_at timestamptz not null default now(),
  source text not null default 'github',
  approved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.ai_audit_logs enable row level security;
alter table public.github_command_registry enable row level security;

create policy if not exists "Service role manages ai audit logs"
on public.ai_audit_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy if not exists "Service role manages command registry"
on public.github_command_registry
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
