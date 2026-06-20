import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Ticket, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { GuestRatingBadge } from "@/components/GuestRatingBadge";
import { cn } from "@/lib/utils";

type Voucher = {
  id: string;
  code: string;
  listing_id: string;
  guest_id: string;
  status: string;
  amount_paid: number;
  duration_hours: number | null;
  booking_id: string | null;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  listings: { title: string } | null;
};

export function HostVouchers({ hostId }: { hostId: string }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [confirmRedeem, setConfirmRedeem] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("vouchers")
      .select("id,code,listing_id,guest_id,status,amount_paid,duration_hours,booking_id,created_at,expires_at,redeemed_at,listings!inner(title,host_id)")
      .eq("listings.host_id", hostId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setVouchers(data.map(v => ({
        ...v,
        listings: Array.isArray(v.listings) ? v.listings[0] ?? null : v.listings
      })) as Voucher[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [hostId]);

  async function handleRedeem(voucherId: string) {
    setRedeeming(voucherId);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-voucher", {
        body: { voucher_id: voucherId },
      });
      if (error || data?.error) throw new Error(data?.message ?? data?.error ?? error?.message ?? "Redeem failed");
      
      toast({ title: "Voucher redeemed successfully", description: "Booking has been generated." });
      setConfirmRedeem(null);
      await load();
    } catch (err) {
      let msg = (err as Error).message;
      try {
        const body = await (err as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: "Redemption failed", description: msg, variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!vouchers.length) return <p className="text-center py-12 text-muted-foreground">No vouchers purchased yet.</p>;

  const statusColor: Record<string, string> = {
    pending_payment: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    redeemed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    refunded: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };

  return (
    <div className="space-y-4">
      {vouchers.map((v) => {
        const isExpired = v.expires_at && new Date(v.expires_at) < new Date();
        const displayStatus = isExpired && v.status === "active" ? "expired" : v.status;
        const canRedeem = v.status === "active" && !isExpired;

        return (
          <div key={v.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm font-mono tracking-wider">{v.code}</p>
                </div>
                <p className="text-sm font-medium mt-1">{v.listings?.title ?? "Listing"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Purchased: {format(parseISO(v.created_at), "MMM d, yyyy")}
                  {v.duration_hours && ` · ${v.duration_hours} hours block`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">₱{v.amount_paid.toLocaleString()}</p>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 inline-block", statusColor[displayStatus] ?? "bg-secondary text-secondary-foreground")}>
                  {displayStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Guest:</span>
              <GuestRatingBadge userId={v.guest_id} />
            </div>

            {v.redeemed_at && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 border-l-2 border-green-500 pl-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Redeemed on {format(parseISO(v.redeemed_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {canRedeem && (
                <Button size="sm" className="gap-1.5" disabled={redeeming === v.id} onClick={() => setConfirmRedeem(v.id)}>
                  {redeeming === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Redeem Voucher
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <Dialog open={!!confirmRedeem} onOpenChange={(open) => !open && setConfirmRedeem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem this voucher? This will immediately create a completed booking record for today and mark the voucher as used. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmRedeem(null)}>Cancel</Button>
            <Button 
              disabled={!confirmRedeem || redeeming === confirmRedeem} 
              onClick={() => confirmRedeem && handleRedeem(confirmRedeem)}
            >
              {redeeming === confirmRedeem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
