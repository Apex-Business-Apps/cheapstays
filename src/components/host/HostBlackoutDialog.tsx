import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type StayType = "hourly" | "overnight" | "both";
type Listing = { id: string; title: string };

type Props = {
  hostId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialDate?: string;
};

export function HostBlackoutDialog({ hostId, open, onOpenChange, onSaved, initialDate }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingId, setListingId] = useState("");
  const [stayType, setStayType] = useState<StayType>("both");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Load host's listings on first open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb.from("listings")
        .select("id,title")
        .eq("host_id", hostId)
        .order("title");
      if (cancelled) return;
      const list = (data ?? []) as Listing[];
      setListings(list);
      if (list.length > 0 && !listingId) setListingId(list[0].id);
    })();
    return () => { cancelled = true; };
  }, [open, hostId, listingId]);

  // Reset form fields when opened; prefill dates from an incoming date pick
  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(initialDate ?? today);
    setEndDate(initialDate ?? today);
    setStayType("both");
    setReason("");
  }, [open, initialDate]);

  const canSave = listingId && startDate && endDate && endDate >= startDate && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const { error } = await sb.from("listing_blackout_dates").insert({
      listing_id: listingId,
      start_date: startDate,
      end_date: endDate,
      stay_type: stayType,
      reason: reason.trim() || null,
      created_by: hostId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dates blocked");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block dates</DialogTitle>
          <DialogDescription>
            Mark dates unavailable — e.g. when a stay is booked on another platform, or
            for maintenance. Blackouts that overlap a confirmed booking are rejected.
          </DialogDescription>
        </DialogHeader>

        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Create a listing first to block dates on it.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="blackout-listing">Listing</Label>
              <select
                id="blackout-listing"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Applies to</Label>
              <Tabs value={stayType} onValueChange={(v) => setStayType(v as StayType)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="overnight">Overnight</TabsTrigger>
                  <TabsTrigger value="hourly">Hourly</TabsTrigger>
                  <TabsTrigger value="both">Both</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-[11px] text-muted-foreground">
                {stayType === "both"
                  ? "Blocks every booking on these dates."
                  : `Blocks ${stayType} bookings only. Other stay modes remain bookable.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blackout-start">Start</Label>
                <Input id="blackout-start" type="date" value={startDate}
                       onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blackout-end">End</Label>
                <Input id="blackout-end" type="date" value={endDate} min={startDate}
                       onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="blackout-reason">Notes (shown to you on the calendar)</Label>
              <Textarea
                id="blackout-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Booked on Airbnb, aircon repair, personal use…"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || listings.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block dates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
