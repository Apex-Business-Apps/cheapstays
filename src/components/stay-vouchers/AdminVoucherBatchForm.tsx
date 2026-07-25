import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Listing = { id: string; title: string };

export function AdminVoucherBatchForm({ onSaved }: { onSaved: () => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listing_id, setListingId] = useState("");
  const [batch_name, setName] = useState("");
  const [nights, setNights] = useState(1);
  const [price_php, setPrice] = useState(1999);
  const [quantity, setQuantity] = useState(50);
  const [valid_days, setValidDays] = useState(14);
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("listings").select("id,title").eq("status", "active").order("title")
      .then(({ data }) => setListings((data ?? []) as Listing[]));
  }, []);

  const canSubmit = listing_id && batch_name && nights > 0 && price_php > 0 && quantity > 0
                  && valid_days >= 1 && valid_days <= 14 && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-stay-voucher-batch-create", {
      body: { listing_id, batch_name, nights, price_php, quantity, valid_days,
              terms: terms || undefined },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Voucher batch created.");
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="b-listing">Listing</Label>
        <select id="b-listing" required value={listing_id} onChange={(e) => setListingId(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Select a listing…</option>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="b-name">Batch name</Label>
        <Input id="b-name" required value={batch_name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="b-nights">Nights</Label>
          <Input id="b-nights" type="number" min={1} max={30}
                 value={nights} onChange={(e) => setNights(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="b-price">Price (₱)</Label>
          <Input id="b-price" type="number" min={1}
                 value={price_php} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="b-qty">Quantity</Label>
          <Input id="b-qty" type="number" min={1} max={500}
                 value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="b-valid">Valid days (1–14)</Label>
          <Input id="b-valid" type="number" min={1} max={14}
                 value={valid_days} onChange={(e) => setValidDays(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <Label htmlFor="b-terms">Terms / inclusions (optional)</Label>
        <Textarea id="b-terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)}
                  placeholder="Free breakfast, late check-out, etc." />
      </div>
      <Button type="submit" disabled={!canSubmit} className="w-full min-h-[44px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create batch"}
      </Button>
    </form>
  );
}
