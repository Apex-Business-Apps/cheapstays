-- Articles & Guides
--
-- Editorial content authored by hosts and admins. Articles live at a short
-- human-readable URL id (e.g. /articles/ak13910). Body is Markdown.
--
-- RLS rules:
--   • Anyone (anon or authed) can SELECT published articles.
--   • The author (host/admin) can SELECT their own drafts.
--   • Admins can SELECT all rows.
--   • Only users with role 'host' or 'admin' can INSERT, and the author_id
--     must equal auth.uid().
--   • The author can UPDATE / DELETE their own row. Admins can UPDATE / DELETE
--     any row.

create extension if not exists pgcrypto;

-- Short URL-friendly id: 2 lowercase letters + 5 digits (e.g. ak13910).
-- Kept short intentionally to match the URL format the product requested.
create or replace function public.gen_article_url_id()
returns text
language plpgsql
volatile
as $$
declare
  letters text := 'abcdefghijklmnopqrstuvwxyz';
  candidate text;
begin
  loop
    candidate :=
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from public.articles where url_id = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists public.articles (
  id             uuid primary key default gen_random_uuid(),
  url_id         text unique not null,
  author_id      uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  excerpt        text not null default '',
  body_markdown  text not null default '',
  cover_path     text,
  category       text not null default 'travel_tips',
  read_minutes   integer not null default 5 check (read_minutes between 1 and 60),
  status         text not null default 'draft' check (status in ('draft', 'published')),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Ensure url_id is auto-generated on insert if the client did not pass one.
create or replace function public.articles_set_url_id()
returns trigger
language plpgsql
as $$
begin
  if new.url_id is null or new.url_id = '' then
    new.url_id := public.gen_article_url_id();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_articles_set_url_id
  before insert or update on public.articles
  for each row execute function public.articles_set_url_id();

create index if not exists idx_articles_published_at on public.articles (published_at desc)
  where status = 'published';
create index if not exists idx_articles_author on public.articles (author_id);
create index if not exists idx_articles_category on public.articles (category);

alter table public.articles enable row level security;

-- Public read of published articles
create policy "Public can view published articles"
  on public.articles
  for select
  using (status = 'published');

-- Author can view all their own rows (including drafts)
create policy "Authors can view their own articles"
  on public.articles
  for select
  to authenticated
  using (author_id = auth.uid());

-- Admins can view all rows
create policy "Admins can view all articles"
  on public.articles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Only hosts and admins can create articles, and only for themselves
create policy "Hosts and admins can insert own articles"
  on public.articles
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.has_role(auth.uid(), 'host'::app_role)
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Authors update / delete their own rows
create policy "Authors can update their own articles"
  on public.articles
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Authors can delete their own articles"
  on public.articles
  for delete
  to authenticated
  using (author_id = auth.uid());

-- Admins can update / delete anything
create policy "Admins can update any article"
  on public.articles
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can delete any article"
  on public.articles
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for cover images. Public bucket so images can be served
-- directly on the marketing surface without signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-covers',
  'article-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Anyone can read a cover (bucket is public but Storage still enforces policies)
create policy "Public can read article covers"
  on storage.objects
  for select
  using (bucket_id = 'article-covers');

-- Hosts and admins can upload to their own author folder ({user_id}/*.ext)
create policy "Hosts and admins can upload article covers"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'article-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      public.has_role(auth.uid(), 'host'::app_role)
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

create policy "Authors can update their own article covers"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'article-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authors can delete their own article covers"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'article-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
