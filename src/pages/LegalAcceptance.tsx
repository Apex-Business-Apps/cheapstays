import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { LegalScrollGate } from "@/components/LegalScrollGate";
import { MarkdownDoc } from "@/pages/legal/MarkdownDoc";
import { legalDocs } from "@/pages/legal/content";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// IMPORTANT: documentVersion/documentHash values MUST match what
// hasRequiredSignupConsent() and the existing signup audit writes already use.
// hasRequiredSignupConsent only filters on (user_id, context_id, document_id);
// it does not version-check — so picking stable identifiers here is safe and
// keeps the audit log internally consistent.
const SIGNUP_TERMS_VERSION = "2026-05-24";
const SIGNUP_TERMS_HASH = "terms-v2026-05-24";
const SIGNUP_PRIVACY_VERSION = "2026-05-24";
const SIGNUP_PRIVACY_HASH = "privacy-v2026-05-24";

type DocId = "terms" | "privacy";

export default function LegalAcceptance() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, consentReady, consentRequired, refreshConsent } = useAuth();
  const [accepted, setAccepted] = useState<Set<DocId>>(new Set());
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Where to send the user once consent is complete — only internal paths.
  const redirectParam = searchParams.get("redirect");
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/";

  // Guard: not signed in → bounce to sign-in, preserving the destination.
  useEffect(() => {
    if (consentReady && !user) {
      const q = redirectParam ? `&redirect=${encodeURIComponent(safeRedirect)}` : "";
      navigate(`/auth?mode=signin${q}`, { replace: true });
    }
  }, [consentReady, user, navigate, redirectParam, safeRedirect]);

  // Guard: consent already complete → return to intended destination.
  useEffect(() => {
    if (consentReady && user && !consentRequired && !loadingExisting) {
      navigate(safeRedirect, { replace: true });
    }
  }, [consentReady, user, consentRequired, loadingExisting, navigate, safeRedirect]);

  // Detect which documents (if any) the user has already accepted in this
  // context, so we render only the missing ones.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) {
        setLoadingExisting(false);
        return;
      }
      const { data, error } = await supabase
        .from("legal_consent_acceptances")
        .select("document_id")
        .eq("user_id", user.id)
        .eq("context_id", "signup")
        .in("document_id", ["terms", "privacy"]);
      if (!active) return;
      if (error) {
        setLoadingExisting(false);
        return;
      }
      const present = new Set<DocId>(
        (data ?? [])
          .map((r) => r.document_id as DocId)
          .filter((d): d is DocId => d === "terms" || d === "privacy"),
      );
      setAccepted(present);
      setLoadingExisting(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const needsTerms = useMemo(() => !accepted.has("terms"), [accepted]);
  const needsPrivacy = useMemo(() => !accepted.has("privacy"), [accepted]);

  const onAccepted = (doc: DocId) => async () => {
    setAccepted((prev) => {
      const next = new Set(prev);
      next.add(doc);
      return next;
    });
    try {
      await refreshConsent();
    } catch {
      // Non-fatal; gate will re-check on next route change.
    }
    // If both done, leave to home.
    if (
      (doc === "terms" && accepted.has("privacy")) ||
      (doc === "privacy" && accepted.has("terms"))
    ) {
      toast({ title: "Thanks — you're all set." });
      navigate(safeRedirect, { replace: true });
    }
  };

  if (!consentReady || loadingExisting) {
    return (
      <div className="container py-16 max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // user check is handled by the redirect effect above; defensive narrow.
  if (!user) return null;

  return (
    <>
      <Seo
        title="CheapStays — Legal Acceptance"
        description="Review and accept the CheapStays Terms of Service and Privacy Policy."
        path="/legal/accept"
      />
      <section className="container py-10 max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Review and accept to continue
          </h1>
          <p className="text-sm text-muted-foreground">
            We need your acknowledgement of the Terms of Service and Privacy
            Policy before you can use authenticated features.
          </p>
        </header>
        {needsTerms && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Terms of Service</h2>
            <LegalScrollGate
              userId={user.id}
              role="guest"
              contextId="signup"
              documentId="terms"
              documentVersion={SIGNUP_TERMS_VERSION}
              documentHash={SIGNUP_TERMS_HASH}
              checkboxLabel="I agree to the Terms of Service."
              legalContent={<MarkdownDoc markdown={legalDocs.terms.markdown} />}
              onAccepted={onAccepted("terms")}
            />
          </Card>
        )}
        {needsPrivacy && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Privacy Policy</h2>
            <LegalScrollGate
              userId={user.id}
              role="guest"
              contextId="signup"
              documentId="privacy"
              documentVersion={SIGNUP_PRIVACY_VERSION}
              documentHash={SIGNUP_PRIVACY_HASH}
              checkboxLabel="I agree to the Privacy Policy."
              legalContent={<MarkdownDoc markdown={legalDocs.privacy.markdown} />}
              onAccepted={onAccepted("privacy")}
            />
          </Card>
        )}
        {!needsTerms && !needsPrivacy && (
          <p className="text-sm text-muted-foreground">All set. Redirecting…</p>
        )}
      </section>
    </>
  );
}
