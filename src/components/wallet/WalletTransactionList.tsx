import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WalletTransaction } from '@/types/wallet';

const TYPE_LABELS: Record<string, string> = {
  credit_pending: 'Booking Credit (Pending)',
  release_to_available: 'Funds Released',
  debit_disbursement: 'Payout Sent',
  admin_adjustment: 'Admin Adjustment',
  debit_failed_reversal: 'Payout Failed — Reversed'
};

const TYPE_COLORS: Record<string, string> = {
  credit_pending: 'text-yellow-500',
  release_to_available: 'text-green-500',
  debit_disbursement: 'text-blue-500',
  admin_adjustment: 'text-purple-500',
  debit_failed_reversal: 'text-destructive'
};

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function WalletTransactionList() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function fetchTransactions() {
      const walletRes = await supabase.from('host_wallets').select('id').single();
      if (!walletRes.data) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', walletRes.data.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      setTransactions((data as unknown as WalletTransaction[]) || []);
      setLoading(false);
    }
    fetchTransactions();
  }, [page]);

  if (loading) return <div className="animate-pulse h-64 rounded-2xl bg-card border border-border" />;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Transaction History</h3>
      </div>

      {transactions.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground text-sm">
          No transactions yet.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {transactions.map(tx => (
            <li key={tx.id} className="px-6 py-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className={`text-sm font-medium ${TYPE_COLORS[tx.type] || 'text-foreground'}`}>
                  {TYPE_LABELS[tx.type] || tx.type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.created_at).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
                {tx.description && (
                  <p className="text-xs text-muted-foreground">{tx.description}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatPHP(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="px-6 py-4 border-t border-border flex justify-between">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-xs text-muted-foreground disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={transactions.length < PAGE_SIZE}
          className="text-xs text-muted-foreground disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
