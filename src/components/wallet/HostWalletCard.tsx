import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HostWallet } from '@/types/wallet';

function getNextPayoutDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP'
  }).format(amount);
}

export function HostWalletCard() {
  const [wallet, setWallet] = useState<HostWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWallet() {
      const { data } = await supabase
        .from('host_wallets')
        .select('*')
        .single();
      setWallet(data);
      setLoading(false);
    }
    fetchWallet();
  }, []);

  if (loading) return <WalletCardSkeleton />;
  if (!wallet) return <WalletCardEmpty />;

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
          <p className="text-2xl font-bold text-foreground">
            {formatPHP(wallet.available_balance)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-bold text-muted-foreground">
            {formatPHP(wallet.pending_balance)}
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Next automatic payout: <span className="font-medium text-foreground">{getNextPayoutDate()}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Minimum payout balance: <span className="font-medium">₱500.00</span>
        </p>
      </div>
    </div>
  );
}

function WalletCardSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 animate-pulse h-48" />
  );
}

function WalletCardEmpty() {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 text-center text-muted-foreground text-sm">
      No wallet found. Your wallet will be created automatically when you receive your first booking.
    </div>
  );
}
