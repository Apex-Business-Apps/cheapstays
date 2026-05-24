import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";

// Minimal types for PayMongo.js browser SDK
interface PaymongoCardElement {
  mount(selector: string): void;
  unmount(): void;
}
interface PaymongoElements {
  create(type: "card"): PaymongoCardElement;
  submit(): Promise<{ paymentMethod?: { id: string }; error?: { message: string } }>;
}
interface PaymongoInstance {
  elements(): PaymongoElements;
  confirmPaymentIntent(opts: {
    clientKey: string;
    paymentMethodType: string;
    paymentMethod: { id: string };
    returnUrl: string;
  }): Promise<{ paymentIntent?: { status: string; next_action?: { redirect?: { url: string } } }; error?: { message: string } }>;
}

declare global {
  interface Window {
    Paymongo?: (publicKey: string) => PaymongoInstance;
  }
}

type Props = {
  bookingId: string;
  totalPhp: number;
  onSuccess: () => void;
};

export function CardHoldForm({ bookingId, totalPhp, onSuccess }: Props) {
  const [sdkReady, setSdkReady] = useState(false);
  const [billingName, setBillingName] = useState("");
  const [processing, setProcessing] = useState(false);
  const pmRef = useRef<PaymongoInstance | null>(null);
  const elementsRef = useRef<PaymongoElements | null>(null);
  const cardRef = useRef<PaymongoCardElement | null>(null);

  const publicKey = import.meta.env.VITE_PAYMONGO_PUBLIC_KEY as string | undefined;

  useEffect(() => {
    if (!publicKey) return;

    const existing = document.getElementById("paymongo-js");
    if (existing) {
      if (window.Paymongo) initSdk();
      else existing.addEventListener("load", initSdk);
      return;
    }

    const script = document.createElement("script");
    script.id = "paymongo-js";
    script.src = "https://js.paymongo.com/v2/paymongo.js";
    script.async = true;
    script.onload = initSdk;
    script.onerror = () => toast({ title: "Payment unavailable", description: "Could not load card SDK. Please try GCash or Maya.", variant: "destructive" });
    document.head.appendChild(script);

    return () => {
      cardRef.current?.unmount();
    };
  }, [publicKey]);

  function initSdk() {
    if (!publicKey || typeof window.Paymongo !== "function") return;
    const pm = window.Paymongo(publicKey);
    const elements = pm.elements();
    const card = elements.create("card");
    pmRef.current = pm;
    elementsRef.current = elements;
    cardRef.current = card;
    card.mount("#paymongo-card-element");
    setSdkReady(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pmRef.current || !elementsRef.current || !billingName.trim()) return;
    setProcessing(true);

    try {
      // 1. Create payment method from card element
      const { paymentMethod, error: pmErr } = await elementsRef.current.submit();
      if (pmErr || !paymentMethod) throw new Error(pmErr?.message ?? "Card submission failed");

      // 2. Create a manual-capture payment intent on our backend
      const { data: intentData, error: intentErr } = await supabase.functions.invoke(
        "payment-intent",
        { body: { booking_id: bookingId, provider: "paymongo", payment_method: "card", hold: true } },
      );
      if (intentErr) {
        let msg = (intentErr as Error).message;
        try {
          const body = await (intentErr as { context?: Response }).context?.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const clientKey: string = intentData.client_key;
      const returnUrl = `${window.location.origin}/my-bookings`;

      // 3. Confirm the payment intent — PayMongo places the card hold
      const { paymentIntent, error: confirmErr } = await pmRef.current.confirmPaymentIntent({
        clientKey,
        paymentMethodType: "card",
        paymentMethod: { id: paymentMethod.id },
        returnUrl,
      });

      if (confirmErr) throw new Error(confirmErr.message);

      const status = paymentIntent?.status;

      if (status === "awaiting_capture") {
        // Hold placed successfully — webhook will confirm the booking
        onSuccess();
        return;
      }

      if (status === "awaiting_next_action") {
        // 3DS required — redirect to bank page; user returns to returnUrl
        const redirectUrl = paymentIntent?.next_action?.redirect?.url;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          throw new Error("3DS redirect URL missing");
        }
        return;
      }

      throw new Error(`Unexpected payment status: ${status}`);
    } catch (err) {
      toast({ title: "Card authorization failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  if (!publicKey) {
    return (
      <p className="text-sm text-destructive text-center">
        Card payments are not configured. Please use GCash or Maya.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Name on card
        </label>
        <Input
          placeholder="Full name"
          value={billingName}
          onChange={(e) => setBillingName(e.target.value)}
          required
          disabled={processing}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Card details
        </label>
        <div
          id="paymongo-card-element"
          className="rounded-md border border-input bg-background px-3 py-2.5 min-h-[42px]"
        />
        {!sdkReady && (
          <p className="text-xs text-muted-foreground mt-1">Loading card form…</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        ₱{totalPhp.toLocaleString()} will be held on your card — not charged yet. Your card is charged on check-in day.
      </p>

      <Button
        type="submit"
        className="w-full"
        disabled={!sdkReady || !billingName.trim() || processing}
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          `Authorize ₱${totalPhp.toLocaleString()} hold`
        )}
      </Button>
    </form>
  );
}
