-- Concierge requests table for auditable AI concierge interactions.
create table if not exists public.concierge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response text,
  status text not null default 'completed' check (status in ('queued','completed','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.concierge_requests enable row level security;

drop policy if exists "Users view their concierge requests, admins view all" on public.concierge_requests;
create policy "Users view their concierge requests, admins view all"
  on public.concierge_requests for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users create their own concierge requests" on public.concierge_requests;
create policy "Users create their own concierge requests"
  on public.concierge_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owner or admin can update concierge requests" on public.concierge_requests;
create policy "Owner or admin can update concierge requests"
  on public.concierge_requests for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create trigger update_concierge_requests_updated_at
  before update on public.concierge_requests
  for each row execute function public.update_updated_at_column();

create index if not exists idx_concierge_requests_user on public.concierge_requests(user_id);
create index if not exists idx_concierge_requests_created_at on public.concierge_requests(created_at desc);

-- Strengthen update policies to enforce write-time role checks and sender ownership.
drop policy if exists "Owner or admin can update ticket" on public.support_tickets;
create policy "Owner or admin can update ticket"
  on public.support_tickets for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Owner posts user messages, admin posts admin messages" on public.support_messages;
create policy "Owner posts user messages, admin posts admin messages"
  on public.support_messages for insert to authenticated
  with check (
    (
      sender = 'user'
      and author_user_id = auth.uid()
      and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
    )
    or (
      sender = 'admin'
      and author_user_id = auth.uid()
      and public.has_role(auth.uid(), 'admin')
    )
  );
