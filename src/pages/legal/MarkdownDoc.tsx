import { Fragment, type ReactNode } from "react";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const inlineFormat = (text: string): ReactNode[] => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <a key={`${match[2]}-${match.index}`} href={match[2]} className="text-primary underline underline-offset-4 hover:opacity-80">
        {match[1]}
      </a>,
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

export function MarkdownDoc({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let numbered: string[] = [];

  const flush = () => {
    if (listItems.length) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-disc space-y-2 pl-6">{listItems.map((item) => <li key={item}>{inlineFormat(item)}</li>)}</ul>);
      listItems = [];
    }
    if (numbered.length) {
      elements.push(<ol key={`ol-${elements.length}`} className="list-decimal space-y-2 pl-6">{numbered.map((item) => <li key={item}>{inlineFormat(item)}</li>)}</ol>);
      numbered = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }

    if (/^\d+\.\s/.test(line)) {
      numbered.push(line.replace(/^\d+\.\s/, ""));
      return;
    }

    flush();

    if (line.startsWith("## ")) {
      const text = line.slice(3);
      const id = slugify(text);
      elements.push(<h2 key={`h2-${idx}`} id={id} className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight"><a href={`#${id}`} className="hover:underline">{text}</a></h2>);
      return;
    }

    if (line.startsWith("# ")) {
      elements.push(<h1 key={`h1-${idx}`} className="text-4xl font-bold tracking-tight">{line.slice(2)}</h1>);
      return;
    }

    elements.push(<p key={`p-${idx}`} className="leading-7 text-muted-foreground">{inlineFormat(line)}</p>);
  });

  flush();
  return <Fragment>{elements}</Fragment>;
}
