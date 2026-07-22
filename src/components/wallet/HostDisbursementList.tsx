import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DisbursementRequest, DisbursementStatus } from '@/types/wallet';

const STATUS_LABEL: Record<DisbursementStatus, string> = {
  pending: 'Awaiting admin',
  awaiting_confirmation: 'Awaiting your confirmation',
  released: 'Released',
  rejected: 'Rejected',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  retrying: 'Retrying',
};

const STATUS_COLOR: Record<DisbursementStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  awaiting_confirmation: 'bg-blue-500/10 text-blue-600',
  released: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
  processing: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
  failed: 'bg-destructive/10 text-destructive',
  retrying: 'bg-orange-500/10 text-orange-600',
};

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function HostDisbursementList() {
  const [rows, setRows] = useState<DisbursementRequest[]>([]);
  const [signedProofs, setSignedProofs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('disbursement_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(10);

    const list = (data as unknown as DisbursementRequest[]) ?? [];
    setRows(list);

    // Sign proof URLs
    const signed: Record<string, string> = {};
    await Promise.all(list.map(async (row) => {
      if (row.proof_image_path) {
        const { data: s } = await supabase.storage
          .from('disbursement-proofs')
          .createSignedUrl(row.proof_image_path, 3600);
        if (s?.signedUrl) signed[row.id] = s.signedUrl;
      }
    }));
    setSignedProofs(signed);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function onConfirm(id: string) {
    setConfirmingId(id);
    const { data, error } = await supabase.functions.invoke('host-confirm-disbursement', {
      body: { disbursement_id: id },
    });
    setConfirmingId(null);
    if (error || (data as { error?: string })?.error) {
      let msg = error?.message ?? (data as { error?: string })?.error ?? 'Confirm failed';
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: 'Confirm failed', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Payout confirmed', description: 'Thank you.' });
    void load();
  }

  if (loading) return <div className="rounded-2xl bg-card border border-border h-40 animate-pulse" />;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Payout Requests</h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground text-sm">
          No payout requests yet.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="px-6 py-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{formatPHP(Number(r.amount))}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Requested {new Date(r.requested_at).toLocaleString('en-PH')}
              </p>

              {r.status === 'awaiting_confirmation' && (
                <div className="mt-2 space-y-2 rounded-xl bg-muted/40 p-3">
                  {signedProofs[r.id] && (
                    <a href={signedProofs[r.id]} target="_blank" rel="noreferrer" className="block">
                      <img src={signedProofs[r.id]} alt="Payment proof" className="max-h-64 rounded-lg object-contain w-full bg-black/5" />
                    </a>
                  )}
                  {r.admin_note && <p className="text-xs text-foreground">{r.admin_note}</p>}
                  <button
                    type="button"
                    onClick={() => onConfirm(r.id)}
                    disabled={confirmingId === r.id}
                    className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 disabled:opacity-50"
                  >
                    {confirmingId === r.id ? 'Confirming…' : 'Confirm received'}
                  </button>
                </div>
              )}

              {r.status === 'rejected' && r.rejection_reason && (
                <p className="text-xs text-destructive">Reason: {r.rejection_reason}</p>
              )}

              {r.status === 'released' && r.confirmed_at && (
                <p className="text-xs text-green-600">Confirmed {new Date(r.confirmed_at).toLocaleDateString('en-PH')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
