import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

// Order matters: bold (**) must come before italic (*) so ** is not consumed as two * matches.
// A new regex instance is created per call so recursive invocations don't share lastIndex state.
const INLINE_PATTERN = /(\*\*(.+?)\*\*|\*([^*\n]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

const inlineFormat = (text: string): ReactNode[] => {
  const re = new RegExp(INLINE_PATTERN.source, "g");
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={m.index}>{inlineFormat(m[2])}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={m.index}>{inlineFormat(m[3])}</em>);
    } else if (m[4] !== undefined) {
      nodes.push(<code key={m.index} className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.875em]">{m[4]}</code>);
    } else if (m[5] !== undefined) {
      const href = m[6];
      nodes.push(
        href.startsWith("/")
          ? <Link key={m.index} to={href} className="text-primary underline underline-offset-4 hover:opacity-80">{m[5]}</Link>
          : <a key={m.index} href={href} className="text-primary underline underline-offset-4 hover:opacity-80" rel="noopener noreferrer">{m[5]}</a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

const isTableRow  = (line: string) => line.startsWith("|") && line.endsWith("|");
const isSeparator = (line: string) => /^\|[\s\-|:]+\|$/.test(line);
const parseRow    = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());

export function MarkdownDoc({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: ReactNode[] = [];
  let listItems:  string[]   = [];
  let numbered:   string[]   = [];
  let tableRows:  string[][] = [];

  const flush = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc space-y-2 pl-6">
          {listItems.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}
        </ul>,
      );
      listItems = [];
    }
    if (numbered.length) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal space-y-2 pl-6">
          {numbered.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}
        </ol>,
      );
      numbered = [];
    }
    if (tableRows.length) {
      const [head, ...body] = tableRows;
      elements.push(
        <div key={`tbl-${elements.length}`} className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {head.map((cell, i) => (
                  <th key={i} className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold">
                    {inlineFormat(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="even:bg-muted/20">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-3 py-2 align-top">
                      {inlineFormat(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableRows = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();

    if (isTableRow(line)) {
      if (!isSeparator(line)) tableRows.push(parseRow(line));
      return;
    }

    if (line.startsWith("- ")) {
      flush();
      listItems.push(line.slice(2));
      return;
    }

    if (/^\d+\.\s/.test(line)) {
      flush();
      numbered.push(line.replace(/^\d+\.\s/, ""));
      return;
    }

    flush();

    if (!line) return;

    if (line.startsWith("### ")) {
      const text = line.slice(4);
      const id = slugify(text);
      elements.push(
        <h3 key={`h3-${idx}`} id={id} className="mt-8 scroll-mt-24 text-xl font-semibold tracking-tight">
          <a href={`#${id}`} className="hover:underline">{text}</a>
        </h3>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      const text = line.slice(3);
      const id = slugify(text);
      elements.push(
        <h2 key={`h2-${idx}`} id={id} className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight">
          <a href={`#${id}`} className="hover:underline">{text}</a>
        </h2>,
      );
      return;
    }

    if (line.startsWith("# ")) {
      elements.push(<h1 key={`h1-${idx}`} className="text-4xl font-bold tracking-tight">{line.slice(2)}</h1>);
      return;
    }

    elements.push(
      <p key={`p-${idx}`} className="leading-7 text-muted-foreground">{inlineFormat(line)}</p>,
    );
  });

  flush();
  return <Fragment>{elements}</Fragment>;
}
