import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Listing = { id: string; title: string };
type Blackout = {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type Props = { hostId: string };

export function BlackoutDateEditor({ hostId }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<string>("");
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadListings() {
      const { data } = await sb.from("listings")
        .select("id,title")
        .eq("host_id", hostId)
        .order("title");
      if (cancelled) return;
      const list = (data ?? []) as Listing[];
      setListings(list);
      if (list.length > 0 && !selectedListing) setSelectedListing(list[0].id);
      setLoading(false);
    }
    loadListings();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId]);

  useEffect(() => {
    if (!selectedListing) return;
    let cancelled = false;
    async function loadBlackouts() {
      const { data } = await sb.from("listing_blackout_dates")
        .select("id,listing_id,start_date,end_date,reason")
        .eq("listing_id", selectedListing)
        .order("start_date");
      if (cancelled) return;
      setBlackouts((data ?? []) as Blackout[]);
    }
    loadBlackouts();
    return () => { cancelled = true; };
  }, [selectedListing]);

  async function addBlackout() {
    if (!selectedListing || !newStart || !newEnd) {
      toast({ title: "Start and end dates are required", variant: "destructive" });
      return;
    }
    if (newEnd < newStart) {
      toast({ title: "End date must be on or after the start date", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await sb.from("listing_blackout_dates")
      .insert({
        listing_id: selectedListing,
        start_date: newStart,
        end_date: newEnd,
        reason: newReason.trim() || null,
        created_by: hostId,
      })
      .select("id,listing_id,start_date,end_date,reason")
      .single();
    setSaving(false);
    if (error) {
      // The guard_blackout_vs_confirmed_bookings trigger rejects edits that
      // overlap a confirmed booking — surface that error verbatim.
      toast({ title: "Cannot add blackout", description: error.message, variant: "destructive" });
      return;
    }
    setBlackouts((prev) => [...prev, data as Blackout].sort((a, b) =>
      a.start_date.localeCompare(b.start_date),
    ));
    setNewStart("");
    setNewEnd("");
    setNewReason("");
    toast({ title: "Blackout added" });
  }

  async function deleteBlackout(id: string) {
    const { error } = await sb.from("listing_blackout_dates").delete().eq("id", id);
    setConfirmDeleteId(null);
    if (error) {
      toast({ title: "Could not remove blackout", description: error.message, variant: "destructive" });
      return;
    }
    setBlackouts((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "Blackout removed" });
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  if (listings.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Create a listing first to manage blackout dates.
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Blackout dates</h3>
          <p className="text-xs text-muted-foreground">
            Mark dates as unavailable for future bookings. Blackouts that overlap a
            confirmed booking are rejected.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Listing</Label>
          <Select value={selectedListing} onValueChange={setSelectedListing}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {listings.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Start</Label>
            <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End</Label>
            <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reason (optional)</Label>
            <Input value={newReason} placeholder="Personal use, maintenance…"
              onChange={(e) => setNewReason(e.target.value)} />
          </div>
        </div>
        <Button size="sm" onClick={addBlackout} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add blackout
        </Button>

        <div className="space-y-2 pt-3 border-t border-border/40">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Existing blackouts ({blackouts.length})
          </p>
          {blackouts.length === 0 && (
            <p className="text-xs text-muted-foreground italic">None — this listing is open for the declared availability window.</p>
          )}
          {blackouts.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border border-border/40 p-2 text-sm">
              <div>
                <p>{format(parseISO(b.start_date), "MMM d")} → {format(parseISO(b.end_date), "MMM d, yyyy")}</p>
                {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => setConfirmDeleteId(b.id)}
                aria-label="Delete blackout"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this blackout?</AlertDialogTitle>
            <AlertDialogDescription>
              These dates will become bookable again, subject to your availability window.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteId && deleteBlackout(confirmDeleteId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
