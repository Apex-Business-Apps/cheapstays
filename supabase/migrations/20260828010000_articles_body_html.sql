-- Switch the article body storage from Markdown to sanitized HTML.
--
-- The initial articles migration used a `body_markdown` column paired with a
-- textarea + hand-rolled Markdown-lite renderer. That was a placeholder while
-- we picked an editor. TipTap (react-first, MIT) outputs HTML, so we rename
-- the column and continue to sanitize on render with DOMPurify.
--
-- Safe to run in place: no article rows exist yet in prod at the time this
-- migration was written (the initial articles migration landed the same day),
-- so no data migration is required.

alter table public.articles
  rename column body_markdown to body_html;
