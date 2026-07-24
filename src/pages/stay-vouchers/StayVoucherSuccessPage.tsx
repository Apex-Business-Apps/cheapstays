import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, MailCheck } from "lucide-react";
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
  const pollCount = useRef(0);

  useEffect(() => {
    if (!purchaseId || !token) return;
    let cancelled = false;
    const tick = async () => {
      const { data, error } = await supabase.functions.invoke("stay-voucher-purchase-lookup", {
        body: { purchase_id: purchaseId, success_token: token },
      });
      if (error) { setState(null); return; }
      if (cancelled) return;
      setState(data as Lookup);
      if ((data as Lookup).payment_status !== "paid" && pollCount.current < MAX_POLLS) {
        pollCount.current++;
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [purchaseId, token]);

  if (!purchaseId || !token) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Missing purchase reference.</div>;
  }
  if (state === undefined) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (state === null) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-2">
        <h1 className="text-xl font-semibold">Purchase not found</h1>
        <p className="text-sm text-muted-foreground">The link may be incorrect. Check your email for the code.</p>
        <Link to="/stay-vouchers" className="text-sm text-primary hover:underline">Browse vouchers</Link>
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
