import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DisbursementRequest } from '@/types/wallet';
import { AdminDisbursementDrawer } from './AdminDisbursementDrawer';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  awaiting_confirmation: 'bg-blue-500/10 text-blue-600',
  released: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
  processing: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-green-500/10 text-green-500',
  failed: 'bg-destructive/10 text-destructive',
  retrying: 'bg-orange-500/10 text-orange-500',
};

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

const FILTERS = ['all', 'pending', 'awaiting_confirmation', 'released', 'rejected'];

export function AdminDisbursementPanel() {
  const [requests, setRequests] = useState<DisbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<DisbursementRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('disbursement_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setRequests((data as unknown as DisbursementRequest[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-foreground">Disbursement Requests</h3>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full capitalize ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-48 m-4 rounded-xl bg-muted" />
      ) : requests.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground text-sm">No disbursement requests found.</div>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="w-full text-left px-6 py-4 hover:bg-muted/50 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{formatPHP(Number(r.amount))}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[r.status] ?? ''}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{r.payout_method}</span>
                  <span>{new Date(r.requested_at).toLocaleString('en-PH')}</span>
                  {r.rejection_reason && <span className="text-destructive">Rejected: {r.rejection_reason}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <AdminDisbursementDrawer
          request={selected}
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          onUpdated={() => void load()}
        />
      )}
    </div>
  );
}
