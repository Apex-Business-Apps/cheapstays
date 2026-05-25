import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

// /legal/accept MUST be exempt — it is the remediation route. Blocking it causes
// an infinite loop where the gate prevents its own resolution.
const EXEMPT = new Set([
  "/auth",
  "/terms",
  "/privacy",
  "/legal",
  "/legal/accept",
]);

export function ConsentGate({ children }: { children: ReactNode }) {
  const { user, consentReady, consentRequired } = useAuth();
  const location = useLocation();

  if (!user || !consentReady || !consentRequired || EXEMPT.has(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="container py-20 max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Legal consent required</h1>
      <p className="text-muted-foreground">
        You must accept Terms and Privacy before using authenticated features.
      </p>
      <Button asChild>
        <Link to="/legal/accept">Review and accept now</Link>
      </Button>
    </div>
  );
}
