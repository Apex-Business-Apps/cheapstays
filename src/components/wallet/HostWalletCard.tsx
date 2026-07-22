import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { HostWallet } from '@/types/wallet';

const MINIMUM_PAYOUT = 500;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

type Gate =
  | { ok: true }
  | { ok: false; reason: string };

export function HostWalletCard() {
  const [wallet, setWallet] = useState<HostWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountVerified, setAccountVerified] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [lastRequestedAt, setLastRequestedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: w }, { data: account }, { data: last }] = await Promise.all([
      supabase.from('host_wallets').select('*').maybeSingle(),
      supabase.from('host_payout_accounts').select('is_verified').maybeSingle(),
      supabase.from('disbursement_requests')
        .select('id, status, requested_at')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setWallet((w as unknown as HostWallet) ?? null);
    setAccountVerified(Boolean(account?.is_verified));
    if (last) {
      const status = (last as { status: string }).status;
      setInFlight(status === 'pending' || status === 'awaiting_confirmation');
      setLastRequestedAt((last as { requested_at: string }).requested_at);
    } else {
      setInFlight(false);
      setLastRequestedAt(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <WalletCardSkeleton />;
  if (!wallet) return <WalletCardEmpty />;

  const gate = evaluateGate({
    balance: Number(wallet.available_balance),
    isFrozen: wallet.is_frozen,
    accountVerified,
    inFlight,
    lastRequestedAt,
  });

  async function onRequest() {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('request-disbursement', {});
    setSubmitting(false);
    if (error || (data && (data as { error?: string }).error)) {
      let msg = error?.message ?? (data as { error?: string })?.error ?? 'Request failed';
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: 'Request failed', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Payout requested', description: 'Admin has been notified.' });
    void load();
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Host Wallet</h2>
        {wallet.is_frozen && (
          <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
            Frozen
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Available</p>
          <p className="text-2xl font-bold text-foreground">{formatPHP(Number(wallet.available_balance))}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-bold text-muted-foreground">{formatPHP(Number(wallet.pending_balance))}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-border space-y-2">
        <button
          type="button"
          disabled={!gate.ok || submitting}
          onClick={onRequest}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Requesting…' : 'Request Payout'}
        </button>
        {!gate.ok && <p className="text-xs text-muted-foreground">{gate.reason}</p>}
        <p className="text-xs text-muted-foreground">
          Minimum payout balance: <span className="font-medium">₱500.00</span> · You can request once every 7 days.
        </p>
      </div>
    </div>
  );
}

function evaluateGate(input: {
  balance: number;
  isFrozen: boolean;
  accountVerified: boolean;
  inFlight: boolean;
  lastRequestedAt: string | null;
}): Gate {
  if (input.isFrozen) return { ok: false, reason: 'Wallet is frozen. Contact support.' };
  if (input.balance < MINIMUM_PAYOUT) return { ok: false, reason: `Reach ₱${MINIMUM_PAYOUT} available to request a payout.` };
  if (!input.accountVerified) return { ok: false, reason: 'Set up and verify your payout account first.' };
  if (input.inFlight) return { ok: false, reason: 'You already have a payout in progress.' };
  if (input.lastRequestedAt) {
    const nextAllowed = new Date(input.lastRequestedAt).getTime() + COOLDOWN_MS;
    if (Date.now() < nextAllowed) {
      const days = Math.ceil((nextAllowed - Date.now()) / (24 * 60 * 60 * 1000));
      return { ok: false, reason: `You can request again in ${days} day${days === 1 ? '' : 's'}.` };
    }
  }
  return { ok: true };
}

function WalletCardSkeleton() {
  return <div className="rounded-2xl bg-card border border-border p-6 animate-pulse h-56" />;
}

function WalletCardEmpty() {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 space-y-2">
      <h2 className="text-lg font-semibold text-foreground">Host Wallet</h2>
      <p className="text-sm text-muted-foreground">
        Your wallet balance will appear here once you receive your first confirmed booking.
      </p>
    </div>
  );
}
