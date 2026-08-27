import DOMPurify from "dompurify";

/**
 * Renders an article body stored as HTML. The HTML is authored via the TipTap
 * editor, which emits a safe subset by default, but we still sanitize on render
 * because RLS allows any host/admin to insert rows directly via the API — the
 * server does not enforce the editor's schema. DOMPurify strips scripts, event
 * handlers, and any tags/attributes outside its allowlist.
 *
 * If the body starts with a `<` it is treated as HTML. Older draft data written
 * as plain paragraphs is wrapped in a paragraph tag so it still renders.
 */
export function ArticleBody({ html }: { html: string }) {
  const raw = html?.trim() ?? "";
  if (!raw) return null;
  const source = raw.startsWith("<") ? raw : `<p>${raw}</p>`;
  const clean = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "s", "u",
      "h2", "h3", "h4",
      "ul", "ol", "li",
      "blockquote", "code", "pre",
      "a", "hr",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
  return (
    <div
      className="prose prose-neutral dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:font-semibold prose-a:text-foreground prose-a:underline-offset-4 prose-strong:text-foreground"
      // Content is sanitized above; setInnerHTML is safe here.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
