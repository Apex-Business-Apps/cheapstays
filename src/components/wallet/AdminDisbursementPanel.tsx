import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DisbursementRequest } from '@/types/wallet';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500',
  processing: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-green-500/10 text-green-500',
  failed: 'bg-destructive/10 text-destructive',
  retrying: 'bg-orange-500/10 text-orange-500'
};

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function AdminDisbursementPanel() {
  const [requests, setRequests] = useState<DisbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function fetch() {
      let query = supabase
        .from('disbursement_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (filter !== 'all') query = query.eq('status', filter);

      const { data } = await query;
      setRequests(data || []);
      setLoading(false);
    }
    fetch();
  }, [filter]);

  const FILTERS = ['all', 'pending', 'processing', 'completed', 'failed', 'retrying'];

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-foreground">Disbursement Requests</h3>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full capitalize ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-48 m-4 rounded-xl bg-muted" />
      ) : requests.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground text-sm">
          No disbursement requests found.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map(r => (
            <li key={r.id} className="px-6 py-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{formatPHP(r.amount)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                  {r.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>{r.payout_method}</span>
                <span>Cycle: {r.cycle_month}</span>
                {r.xendit_disbursement_id && <span>Xendit: {r.xendit_disbursement_id}</span>}
                {r.failure_reason && <span className="text-destructive">{r.failure_reason}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
