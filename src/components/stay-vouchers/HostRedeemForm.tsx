import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Preview = {
  batch_name: string; nights: number; price_php: number;
  buyer_name: string; valid_until: string; status: string;
  listing: { id: string; title: string };
};

export function HostRedeemForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [listingId, setListingId] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [busy, setBusy] = useState<"preview" | "redeem" | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("listings").select("id,title").eq("host_id", user.id).eq("status", "active").order("title")
      .then((res: unknown) => setListings((res as { data: { id: string; title: string }[] }).data ?? []));
  }, [user?.id]);

  const onPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !listingId) return;
    setBusy("preview");
    const { data, error } = await supabase.functions.invoke("host-stay-voucher-preview", { body: { code } });
    setBusy(null);
    if (error) { toast.error(error.message); setPreview(null); return; }
    const p = data as Preview;
    if (p.listing.id !== listingId) {
      toast.error("This voucher is for a different property.");
      setPreview(null);
      return;
    }
    setPreview(p);
    setCheckIn(new Date().toISOString().slice(0, 10));
  };

  const onRedeem = async () => {
    if (!preview || !checkIn) return;
    setBusy("redeem");
    const { data, error } = await supabase.functions.invoke("host-stay-voucher-redeem", {
      body: { code, listing_id: listingId, p_check_in: checkIn },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const { booking_id } = data as { booking_id: string };
    toast.success("Voucher redeemed. Booking created.");
    navigate(`/host/bookings?highlight=${booking_id}`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onPreview} className="space-y-3">
        <div>
          <Label htmlFor="r-listing">Listing</Label>
          <select id="r-listing" role="combobox" required value={listingId} onChange={(e) => setListingId(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Select a listing…</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="r-code">Voucher code</Label>
          <Input id="r-code" value={code} required
                 onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="CS-XXXX-XXXX" />
        </div>
        <Button type="submit" disabled={busy !== null || !code || !listingId} className="min-h-[44px]">
          {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
        </Button>
      </form>

      {preview && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">{preview.batch_name}</p>
            <p className="text-sm font-medium">{preview.listing.title}</p>
            <p className="text-xs text-muted-foreground">
              {preview.nights} night{preview.nights === 1 ? "" : "s"} · ₱{preview.price_php.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Guest: <strong>{preview.buyer_name}</strong></p>
            <p className="text-[10px] text-muted-foreground">
              Valid until {new Date(preview.valid_until).toLocaleString("en-PH")}
            </p>
          </div>
          <div>
            <Label htmlFor="r-checkin">Check-in date</Label>
            <Input id="r-checkin" type="date" required value={checkIn}
                   onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <Button onClick={onRedeem} disabled={busy !== null || !checkIn} className="w-full min-h-[44px]">
            {busy === "redeem" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm redemption"}
          </Button>
        </Card>
      )}
    </div>
  );
}
