import supportDoc from "../../../docs/legal/support.md?raw";
import privacyDoc from "../../../docs/legal/privacy.md?raw";
import termsDoc from "../../../docs/legal/terms.md?raw";
import hostTermsDoc from "../../../docs/legal/host-terms.md?raw";
import renterRulesDoc from "../../../docs/legal/renter-rules.md?raw";
import refundsDoc from "../../../docs/legal/refunds.md?raw";
import safetyDoc from "../../../docs/legal/safety.md?raw";
import accountDeletionDoc from "../../../docs/legal/account-deletion.md?raw";
import legalDoc from "../../../docs/legal/legal.md?raw";

export type LegalDocMeta = {
  title: string;
  path: string;
  version: string;
  publishedOn: string;
  markdown: string;
};

export const LEGAL_CONTACT_EMAIL = "legal@cheapstays.com";

export const legalDocs: Record<string, LegalDocMeta> = {
  support: { title: "Support", path: "/support", version: "v1.0", publishedOn: "2026-05-22", markdown: supportDoc },
  privacy: { title: "Privacy Policy", path: "/privacy", version: "v1.0", publishedOn: "2026-05-22", markdown: privacyDoc },
  terms: { title: "Terms of Service", path: "/terms", version: "v1.0", publishedOn: "2026-05-22", markdown: termsDoc },
  "host-terms": { title: "Host Terms", path: "/host-terms", version: "v1.0", publishedOn: "2026-05-22", markdown: hostTermsDoc },
  "renter-rules": { title: "Renter Rules", path: "/renter-rules", version: "v1.0", publishedOn: "2026-05-22", markdown: renterRulesDoc },
  refunds: { title: "Refund Policy", path: "/refunds", version: "v1.0", publishedOn: "2026-05-22", markdown: refundsDoc },
  safety: { title: "Safety Center", path: "/safety", version: "v1.0", publishedOn: "2026-05-22", markdown: safetyDoc },
  "account-deletion": { title: "Account Deletion", path: "/account-deletion", version: "v1.0", publishedOn: "2026-05-22", markdown: accountDeletionDoc },
  legal: { title: "Legal Center", path: "/legal", version: "v1.0", publishedOn: "2026-05-22", markdown: legalDoc },
};
