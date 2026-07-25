import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, MailCheck, XCircle, AlertTriangle, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VoucherCodeDisplay } from "@/components/stay-vouchers/VoucherCodeDisplay";
import { toast } from "sonner";

type Lookup = {
  payment_status: "pending" | "paid" | "failed";
  codes: string[] | null;
  batch: {
    name: string; nights: number; price_php: number;
    valid_until: string | null;
    listing: { id: string; title: string; city: string | null };
  };
};

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 60; // 3 minutes

export default function StayVoucherSuccessPage() {
  const [params] = useSearchParams();
  const purchaseId = params.get("purchase");
  const token = params.get("token");

  const [state, setState] = useState<Lookup | null | undefined>(undefined);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!purchaseId || !token) return;
    let cancelled = false;
    const tick = async () => {
      const { data, error } = await supabase.functions.invoke("stay-voucher-purchase-lookup", {
        body: { purchase_id: purchaseId, success_token: token },
      });
      if (cancelled) return;
      if (error) { setState(null); return; }
      const next = data as Lookup;
      setState(next);
      if (next.payment_status === "paid" || next.payment_status === "failed") return;
      if (pollCount.current >= MAX_POLLS) { setTimedOut(true); return; }
      pollCount.current++;
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => { cancelled = true; };
  }, [purchaseId, token]);

  if (!purchaseId || !token) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center space-y-3">
        <XCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h1 className="text-xl font-semibold">Missing purchase reference</h1>
        <p className="text-sm text-muted-foreground">
          This page needs a purchase link. If you just paid, check your email for the code.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/stay-vouchers">Browse vouchers</Link>
          </Button>
          <Button asChild className="min-h-[44px]">
            <Link to="/"><Home className="h-4 w-4 mr-2" /> Return home</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (state === undefined) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (state === null) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center space-y-3">
        <XCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h1 className="text-xl font-semibold">Purchase not found</h1>
        <p className="text-sm text-muted-foreground">
          The link may be incorrect or expired. If you completed payment, your voucher code was emailed to you.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/stay-vouchers">Browse vouchers</Link>
          </Button>
          <Button asChild className="min-h-[44px]">
            <Link to="/"><Home className="h-4 w-4 mr-2" /> Return home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const resend = async () => {
    const { error } = await supabase.functions.invoke("stay-voucher-resend-email", {
      body: { purchase_id: purchaseId, success_token: token },
    });
    if (error) toast.error("Could not resend right now. Try again in a minute.");
    else toast.success("Sent — check your inbox.");
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      <Seo title="Your voucher · CheapStays" description="Voucher purchase confirmation." path="/stay-vouchers/success" />
      <Card className="p-6 space-y-4 text-center">
        {state.payment_status === "paid" ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div>
              <h1 className="text-xl font-semibold">Voucher{(state.codes ?? []).length > 1 ? "s" : ""} ready</h1>
              <p className="text-sm text-muted-foreground">
                {state.batch.name} · {state.batch.nights} night{state.batch.nights === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                For <strong>{state.batch.listing.title}</strong>{state.batch.listing.city ? `, ${state.batch.listing.city}` : ""}
              </p>
            </div>
            <div className="space-y-2 text-left">
              {(state.codes ?? []).map((c) => <VoucherCodeDisplay key={c} code={c} />)}
            </div>
            {state.batch.valid_until && (
              <p className="text-xs text-muted-foreground">
                Valid until <strong>{new Date(state.batch.valid_until).toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })}</strong>. Save this code — show it to the host at check-in.
              </p>
            )}
            <Button type="button" variant="outline" onClick={resend} className="min-h-[44px]">
              <MailCheck className="h-4 w-4 mr-2" /> Resend email
            </Button>
          </>
        ) : state.payment_status === "failed" ? (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <h1 className="text-xl font-semibold">Payment failed</h1>
              <p className="text-sm text-muted-foreground mt-1">
                We couldn't process this payment. You have not been charged.
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 text-left rounded-md bg-secondary/40 p-3">
              <p>What to try next:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Retry with a different card or e-wallet.</li>
                <li>Check that your card is enabled for online purchases.</li>
                <li>If you were charged in your bank app, contact <a href="/customer-support" className="text-primary underline">support</a> — we'll reconcile it.</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/stay-vouchers"><MailCheck className="h-4 w-4 mr-2" /> Try another voucher</Link>
              </Button>
              <Button asChild className="min-h-[44px]">
                <Link to="/"><Home className="h-4 w-4 mr-2" /> Return home</Link>
              </Button>
            </div>
          </>
        ) : timedOut ? (
          <>
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <div>
              <h1 className="text-lg font-semibold">Still waiting for confirmation</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Your payment provider hasn't confirmed the charge yet. This is unusual — most payments settle within a minute.
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 text-left rounded-md bg-secondary/40 p-3">
              <p>Two things you can do:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><strong>Check your inbox</strong> — if payment succeeded, your voucher code was emailed.</li>
                <li><strong>Refresh this page</strong> in a minute. If still stuck, contact support with reference <code className="font-mono">{purchaseId?.slice(0, 8)}</code>.</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => window.location.reload()} className="min-h-[44px]">
                Refresh
              </Button>
              <Button asChild className="min-h-[44px]">
                <Link to="/"><Home className="h-4 w-4 mr-2" /> Return home</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <h1 className="text-lg font-semibold">Finalising your voucher…</h1>
            <p className="text-sm text-muted-foreground">
              Waiting for payment confirmation. This usually takes a few seconds.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
