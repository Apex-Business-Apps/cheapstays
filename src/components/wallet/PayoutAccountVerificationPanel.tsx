import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type PayoutAccountRow = {
  id: string;
  host_id: string;
  display_name: string;
  payout_method: string;
  account_holder_name: string;
  is_verified: boolean;
  created_at: string;
};

const METHOD_LABEL: Record<string, string> = {
  GCASH: "GCash",
  MAYA: "Maya",
  PH_BANK: "Philippine Bank",
};

export function PayoutAccountVerificationPanel() {
  const [accounts, setAccounts] = useState<PayoutAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payout-account`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "list" }),
      }
    );
    const json = await res.json();
    setAccounts(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(hostId: string) {
    setApprovingId(hostId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payout-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "approve", host_id: hostId }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast({ title: "Payout account verified", description: "The host's payout account has been approved." });
        setAccounts(prev => prev.map(a => a.host_id === hostId ? { ...a, is_verified: true } : a));
      } else {
        toast({ title: "Approval failed", description: json.error ?? "Something went wrong.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Approval failed", description: "Network error.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  }

  const displayed = filter === "pending" ? accounts.filter(a => !a.is_verified) : accounts;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Payout Account Verification</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and approve host payout accounts before disbursements are sent.
          </p>
        </div>
        <div className="flex gap-2">
          {(["pending", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {f === "pending" ? `Pending (${accounts.filter(a => !a.is_verified).length})` : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-32 m-4 rounded-xl bg-muted" />
      ) : displayed.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground text-sm">
          {filter === "pending" ? "No pending payout accounts to verify." : "No payout accounts found."}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {displayed.map(account => (
            <li key={account.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{account.display_name}</p>
                  {account.is_verified
                    ? <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">Verified</span>
                    : <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full font-medium">Pending</span>
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {METHOD_LABEL[account.payout_method] ?? account.payout_method} · {account.account_holder_name}
                </p>
                <p className="text-xs text-muted-foreground font-mono truncate">{account.host_id}</p>
              </div>

              {!account.is_verified && (
                <button
                  onClick={() => handleApprove(account.host_id)}
                  disabled={approvingId === account.host_id}
                  className="shrink-0 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {approvingId === account.host_id ? "Approving…" : "Approve"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
