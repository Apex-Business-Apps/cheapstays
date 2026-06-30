import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { createLegalAcceptanceAudit } from "@/lib/legal-consent";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const navigate = useNavigate();
  const { user, consentReady, consentRequired } = useAuth();

  // Only allow internal, same-origin paths to avoid open-redirect abuse.
  const redirectParam = searchParams.get("redirect");
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/";

  useEffect(() => {
    if (!user) return;
    // Wait for consent state to settle before redirecting, otherwise we may
    // send a user to the destination only to bounce them through the gate one
    // render later.
    if (!consentReady) return;
    if (consentRequired) {
      // Carry the destination through the consent gate so first-time accounts
      // still land back where they started (e.g. the listing they were booking).
      navigate(`/legal/accept?redirect=${encodeURIComponent(safeRedirect)}`, { replace: true });
    } else {
      navigate(safeRedirect, { replace: true });
    }
  }, [user, consentReady, consentRequired, navigate, safeRedirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!acceptTerms || !acceptPrivacy) throw new Error("You must accept Terms and Privacy to continue.");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}${safeRedirect}` },
        });
        if (error) throw error;
        if (data.user?.id) {
          const now = new Date().toISOString();
          await createLegalAcceptanceAudit({ userId: data.user.id, role: "guest", contextId: "signup", documentId: "terms", documentVersion: "2026-05-24", documentHash: "terms-v2026-05-24", checkboxLabel: "I agree to Terms", scrolledToBottom: true, gateOpenedAt: now, scrollCompletedAt: now });
          await createLegalAcceptanceAudit({ userId: data.user.id, role: "guest", contextId: "signup", documentId: "privacy", documentVersion: "2026-05-24", documentHash: "privacy-v2026-05-24", checkboxLabel: "I agree to Privacy", scrolledToBottom: true, gateOpenedAt: now, scrollCompletedAt: now });
        }
        toast({ title: "Check your inbox", description: "Confirm your email to finish signing up." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast({ title: "Auth error", description: (err as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function google() {
    setOauthLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${safeRedirect}` },
      });
    } finally {
      setOauthLoading(false);
    }
  }

  return (
    <div>
      <Seo title="CheapStays Login" description="Secure sign up and login for CheapStays members and hosts." path="/auth" />
    <div className="container max-w-md py-20">
      <Card className="p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin" ? "Sign in to keep hunting deals." : "Start finding owner-direct stays."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {mode === "signup" && (
            <div className="space-y-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                <span>I agree to the Terms of Service.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
                <span>I agree to the Privacy Policy.</span>
              </label>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "…" : mode === "signin" ? "Log in" : "Sign up"}
          </Button>
        </form>
        <Button variant="outline" className="w-full mt-3" onClick={google} disabled={oauthLoading}>{oauthLoading ? "…" : mode === "signin" ? "Log in with Google" : "Sign up with Google"}</Button>
        <button
          type="button"
          className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          aria-live="polite"
        >
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
    </div>
  );
}