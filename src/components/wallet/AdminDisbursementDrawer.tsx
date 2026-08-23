import { useEffect, useState } from 'react';
import { Copy, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DisbursementRequest } from '@/types/wallet';

type PayoutAccount = {
  payout_method: string;
  account_holder_name: string;
  account_number: string;
  is_verified: boolean;
  updated_at: string;
};

interface Props {
  request: DisbursementRequest;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function AdminDisbursementDrawer({ request, open, onClose, onUpdated }: Props) {
  const [hostName, setHostName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [signedProof, setSignedProof] = useState<string | null>(null);
  const [account, setAccount] = useState<PayoutAccount | null | 'missing' | { error: string }>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHost() {
      const { data: wallet } = await supabase
        .from('host_wallets').select('host_id').eq('id', request.wallet_id).maybeSingle();
      const hostId = (wallet as { host_id?: string } | null)?.host_id;
      if (!hostId) return;
      const { data: profile } = await supabase
        .from('profiles').select('display_name').eq('user_id', hostId).maybeSingle();
      if (!cancelled) setHostName((profile as { display_name?: string } | null)?.display_name ?? hostId);
    }
    void loadHost();
    return () => { cancelled = true; };
  }, [request.wallet_id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAccount(null);
    async function loadAccount() {
      const result = await supabase.functions.invoke('admin-get-payout-account', {
        body: { disbursement_id: request.id },
      });
      if (cancelled) return;
      const { data, error } = result ?? {};
      if (error) {
        let serverMsg: string | null = null;
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (body?.error) serverMsg = body.error;
        } catch { /* ignore */ }
        if (serverMsg === 'Host has no payout account on file') {
          setAccount('missing');
        } else {
          setAccount({ error: serverMsg ?? error.message ?? 'Failed to load payout account' });
        }
        return;
      }
      setAccount((data ?? null) as PayoutAccount | null);
    }
    void loadAccount();
    return () => { cancelled = true; };
  }, [open, request.id]);

  useEffect(() => {
    let cancelled = false;
    async function signProof() {
      if (!request.proof_image_path) { setSignedProof(null); return; }
      const { data } = await supabase.storage
        .from('disbursement-proofs')
        .createSignedUrl(request.proof_image_path, 3600);
      if (!cancelled) setSignedProof(data?.signedUrl ?? null);
    }
    void signProof();
    return () => { cancelled = true; };
  }, [request.proof_image_path]);

  async function onSaveProof() {
    if (!file) {
      toast({ title: 'Choose an image first', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${request.wallet_id}/${request.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('disbursement-proofs')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setSaving(false);
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { error } = await supabase.functions.invoke('admin-attach-disbursement-proof', {
      body: { disbursement_id: request.id, proof_image_path: path, admin_note: note || undefined },
    });
    setSaving(false);
    if (error) {
      let msg = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: 'Save proof failed', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Proof saved', description: 'Host has been notified.' });
    onUpdated();
    onClose();
  }

  async function onReject() {
    const reason = window.prompt('Reason for rejecting this payout request?');
    if (!reason?.trim()) return;
    setRejecting(true);
    const { error } = await supabase.functions.invoke('admin-reject-disbursement', {
      body: { disbursement_id: request.id, rejection_reason: reason.trim() },
    });
    setRejecting(false);
    if (error) {
      let msg = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: 'Reject request failed', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request rejected', description: 'Wallet refunded.' });
    onUpdated();
    onClose();
  }

  const canUpload = request.status === 'pending';
  const canReject = request.status === 'pending' || request.status === 'awaiting_confirmation';

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Disbursement · {formatPHP(Number(request.amount))}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm">
          <div><span className="text-muted-foreground">Host:</span> <span className="font-medium">{hostName || '—'}</span></div>
          <div><span className="text-muted-foreground">Status:</span> <span className="font-medium capitalize">{request.status.replace(/_/g, ' ')}</span></div>
          <div><span className="text-muted-foreground">Method:</span> <span className="font-medium">{request.payout_method}</span></div>
          <div><span className="text-muted-foreground">Requested:</span> <span className="font-medium">{new Date(request.requested_at).toLocaleString('en-PH')}</span></div>
          {signedProof && (
            <a href={signedProof} target="_blank" rel="noreferrer" className="block">
              <img src={signedProof} alt="Current proof" className="max-h-64 rounded-lg object-contain w-full bg-black/5" />
            </a>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payout account</span>
            {account && account !== 'missing' && !('error' in account) && (
              account.is_verified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" /> Unverified
                </span>
              )
            )}
          </div>

          {account === null ? (
            <>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </>
          ) : account === 'missing' ? (
            <div className="text-xs text-destructive">
              Host has no payout account on file. Do not disburse — reject and ask host to add one.
            </div>
          ) : 'error' in account ? (
            <div className="text-xs text-destructive">
              Couldn't load payout account: {account.error}. Do not disburse — reject and ask host to re-enter their details.
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Method: </span>
                <span className="font-medium uppercase">{account.payout_method}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Account holder: </span>
                <span className="font-medium">{account.account_holder_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Number: </span>
                <span className="font-mono font-medium tabular-nums">{account.account_number}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(account.account_number).then(
                      () => toast({ title: 'Account number copied' }),
                      () => toast({ title: 'Copy failed', variant: 'destructive' }),
                    );
                  }}
                  className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Copy account number"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Last updated {new Date(account.updated_at).toLocaleDateString('en-PH')}
              </div>
            </div>
          )}
        </div>

        {canUpload && (
          <div className="mt-6 space-y-3">
            <label className="block text-xs font-medium text-foreground">Payment proof (screenshot / QR)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note to the host (e.g. Reference #)"
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
              rows={3}
            />
            <button
              type="button"
              onClick={onSaveProof}
              disabled={!file || saving}
              className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save proof'}
            </button>
          </div>
        )}

        {canReject && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onReject}
              disabled={rejecting}
              className="w-full rounded-lg border border-destructive text-destructive text-sm font-medium py-2 disabled:opacity-50"
            >
              {rejecting ? 'Rejecting…' : 'Reject request'}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
