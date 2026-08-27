import { Fragment } from "react";

/**
 * Minimal Markdown renderer for article bodies. Supports the subset we
 * actually need for editorial content: `#`/`##` headings, `-` bullet lists,
 * `**bold**`, `[text](url)` links, and paragraph breaks on blank lines.
 *
 * XSS-safe: all text is rendered as React children, no dangerouslySetInnerHTML,
 * and link hrefs are validated to `http(s)` or `/` before rendering.
 */

type Token =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p";  text: string }
  | { kind: "ul"; items: string[] };

function safeHref(raw: string): string | null {
  if (raw.startsWith("/") || raw.startsWith("#")) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:") {
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return null;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match either **bold** or [text](href). Left-to-right.
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={key++}>{m[1]}</strong>);
    } else if (m[2] !== undefined && m[3] !== undefined) {
      const href = safeHref(m[3]);
      if (href) {
        const external = /^https?:/.test(href);
        nodes.push(
          <a
            key={key++}
            href={href}
            className="underline underline-offset-4 hover:text-primary"
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer noopener" : undefined}
          >
            {m[2]}
          </a>,
        );
      } else {
        nodes.push(m[2]);
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function tokenize(markdown: string): Token[] {
  const tokens: Token[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      tokens.push({ kind: "h3", text: trimmed.slice(3) });
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      tokens.push({ kind: "h2", text: trimmed.slice(2) });
      i++;
      continue;
    }
    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      tokens.push({ kind: "ul", items });
      continue;
    }
    // Otherwise, treat consecutive non-blank lines as a single paragraph.
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("- ")
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    tokens.push({ kind: "p", text: buf.join(" ") });
  }
  return tokens;
}

export function ArticleBody({ markdown }: { markdown: string }) {
  const tokens = tokenize(markdown);
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:font-semibold prose-a:text-foreground prose-a:underline-offset-4 prose-strong:text-foreground">
      {tokens.map((t, idx) => {
        if (t.kind === "h2") return <h2 key={idx}>{t.text}</h2>;
        if (t.kind === "h3") return <h3 key={idx}>{t.text}</h3>;
        if (t.kind === "ul") {
          return (
            <ul key={idx}>
              {t.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx}>
            {renderInline(t.text).map((n, j) => (
              <Fragment key={j}>{n}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
