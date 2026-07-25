import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  batch: {
    id: string; batch_name: string; nights: number;
    price_php: number; valid_days: number; listing_title: string;
  };
};

export function VoucherPurchaseForm({ batch }: Props) {
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");
  const [phone,  setPhone]  = useState("");
  const [method, setMethod] = useState<"gcash"|"maya"|"card">("gcash");
  const [accept, setAccept] = useState(false);
  const [busy,   setBusy]   = useState(false);

  const canSubmit = accept && name.length > 0 && email.includes("@") && phone.length >= 6 && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("stay-voucher-checkout", {
      body: { batch_id: batch.id, quantity: 1,
              buyer_name: name, buyer_email: email, buyer_phone: phone,
              payment_method: method, accept_terms: true },
    });
    if (error || !(data as { checkout_url?: string })?.checkout_url) {
      setBusy(false);
      toast.error((error as Error | null)?.message ?? "Could not start checkout. Please try again.");
      return;
    }
    window.location.assign((data as { checkout_url: string }).checkout_url);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="v-name">Name</Label>
        <Input id="v-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="v-email">Email</Label>
        <Input id="v-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="v-phone">Phone</Label>
        <Input id="v-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63…" />
      </div>
      <div className="space-y-2">
        <Label>Payment method</Label>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)}
                    className="grid grid-cols-3 gap-2">
          {(["gcash","maya","card"] as const).map((m) => (
            <div key={m} className="flex items-center gap-2 border rounded-md p-2">
              <RadioGroupItem id={`v-${m}`} value={m} />
              <Label htmlFor={`v-${m}`} className="capitalize text-sm">{m}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <Checkbox checked={accept} onCheckedChange={(v) => setAccept(v === true)} className="mt-0.5" />
        <span>I understand this voucher is <strong>non-refundable</strong>, valid for {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"} after purchase, and must be redeemed with the host at check-in.</span>
      </label>
      <Button type="submit" disabled={!canSubmit} className="w-full min-h-[44px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Buy voucher — ₱${batch.price_php.toLocaleString()}`}
      </Button>
    </form>
  );
}
