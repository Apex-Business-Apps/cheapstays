-- Immutable audit trail for legal consent acceptance events.
create table if not exists public.legal_consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  context_id text not null,
  document_id text not null,
  document_version text not null,
  document_hash text not null,
  checkbox_label text not null,
  scrolled_to_bottom boolean not null,
  accepted_at timestamptz not null default now(),
  scroll_completed_at timestamptz,
  gate_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint legal_consent_scroll_timestamp_ck
    check ((not scrolled_to_bottom and scroll_completed_at is null) or (scrolled_to_bottom and scroll_completed_at is not null))
);

alter table public.legal_consent_acceptances enable row level security;

create policy "Users can insert own legal consent records"
  on public.legal_consent_acceptances
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view own legal consent records"
  on public.legal_consent_acceptances
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists legal_consent_lookup_idx
  on public.legal_consent_acceptances(user_id, role, context_id, document_id, accepted_at desc);

-- Prevent updates/deletes to keep the audit log immutable.
create or replace function public.prevent_legal_consent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'legal_consent_acceptances is immutable';
end;
$$;

drop trigger if exists legal_consent_prevent_update on public.legal_consent_acceptances;
create trigger legal_consent_prevent_update
before update on public.legal_consent_acceptances
for each row execute function public.prevent_legal_consent_mutation();

drop trigger if exists legal_consent_prevent_delete on public.legal_consent_acceptances;
create trigger legal_consent_prevent_delete
before delete on public.legal_consent_acceptances
for each row execute function public.prevent_legal_consent_mutation();

create or replace function public.legal_fast_accept_eligible(
  p_user_id uuid,
  p_role text,
  p_context_id text,
  p_document_id text,
  p_document_version text,
  p_document_hash text,
  p_changed_topics text[] default '{}'
)
returns table(
  eligible boolean,
  requires_full_scroll boolean,
  reason text,
  last_acceptance_id uuid,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sensitive_topics constant text[] := array[
    'payments', 'privacy', 'safety', 'liability', 'verification',
    'refunds', 'disputes', 'payout', 'surveillance', 'host access', 'governing terms'
  ];
  v_last public.legal_consent_acceptances%rowtype;
  v_has_sensitive_change boolean;
begin
  v_has_sensitive_change := exists (
    select 1
    from unnest(coalesce(p_changed_topics, '{}'::text[])) as topic
    where lower(topic) = any(sensitive_topics)
  );

  if v_has_sensitive_change then
    return query select false, true, 'material_changes_require_full_scroll', null::uuid, null::timestamptz;
    return;
  end if;

  select *
  into v_last
  from public.legal_consent_acceptances
  where user_id = p_user_id
    and role = p_role
    and context_id = p_context_id
    and document_id = p_document_id
  order by accepted_at desc
  limit 1;

  if not found then
    return query select false, false, 'no_prior_acceptance', null::uuid, null::timestamptz;
    return;
  end if;

  if v_last.document_version = p_document_version and v_last.document_hash = p_document_hash and v_last.scrolled_to_bottom then
    return query select true, false, 'eligible_same_user_role_context_document', v_last.id, v_last.accepted_at;
    return;
  end if;

  return query select false, true, 'document_changed_or_incomplete_scroll', v_last.id, v_last.accepted_at;
end;
$$;

revoke all on function public.legal_fast_accept_eligible(uuid, text, text, text, text, text, text[]) from public;
grant execute on function public.legal_fast_accept_eligible(uuid, text, text, text, text, text, text[]) to authenticated;
