import { Seo } from "@/components/Seo";
import { MarkdownDoc } from "@/pages/legal/MarkdownDoc";
import { LEGAL_CONTACT_EMAIL, legalDocs } from "@/pages/legal/content";

export function LegalDocumentPage({ docKey }: { docKey: keyof typeof legalDocs }) {
  const doc = legalDocs[docKey];

  return (
    <>
      <Seo title={`CheapStays ${doc.title}`} description={`${doc.title} for CheapStays.`} path={doc.path} />
      <section className="container py-8 sm:py-12">
        <article className="mx-auto max-w-4xl rounded-xl border border-border/60 bg-card p-5 shadow-sm sm:p-8">
          <header className="mb-8 border-b border-border/60 pb-4">
            <p className="text-sm text-muted-foreground">Official contact: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline underline-offset-4">{LEGAL_CONTACT_EMAIL}</a></p>
            <p className="mt-2 text-xs text-muted-foreground">Version {doc.version} · Published {doc.publishedOn}</p>
          </header>
          <div className="space-y-5">
            <MarkdownDoc markdown={doc.markdown} />
          </div>
        </article>
      </section>
    </>
  );
}
