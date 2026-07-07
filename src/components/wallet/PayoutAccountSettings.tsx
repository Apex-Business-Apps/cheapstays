import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { PayoutMethod } from '@/types/wallet';

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'GCASH', label: 'GCash' },
  { value: 'MAYA', label: 'Maya' },
  { value: 'PH_BANK', label: 'Philippine Bank Account' }
];

const METHOD_LABEL: Record<PayoutMethod, string> = {
  GCASH: 'GCash',
  MAYA: 'Maya',
  PH_BANK: 'Philippine Bank Account',
};

export function PayoutAccountSettings() {
  const [method, setMethod] = useState<PayoutMethod>('GCASH');
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [savedMethod, setSavedMethod] = useState<PayoutMethod | null>(null);
  const [savedName, setSavedName] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('host_payout_accounts')
      .select('payout_method, account_holder_name, is_verified')
      .single()
      .then(({ data }) => {
        if (data) {
          setSavedMethod(data.payout_method as PayoutMethod);
          setSavedName(data.account_holder_name);
          setIsVerified(data.is_verified ?? false);
          setMethod(data.payout_method as PayoutMethod);
          setHolderName(data.account_holder_name);
        } else {
          setEditing(true);
        }
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    if (!holderName || !accountNumber) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payout-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payout_method: method,
            account_holder_name: holderName,
            account_number: accountNumber,
          }),
        }
      );

      if (res.ok) {
        setSavedMethod(method);
        setSavedName(holderName);
        setAccountNumber('');
        setEditing(false);
        toast({ title: 'Payout account saved', description: 'Your account details have been encrypted and saved.' });
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: 'Save failed', description: body?.error ?? 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Save failed', description: 'Network error. Please check your connection and try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleEdit() {
    setMethod(savedMethod ?? 'GCASH');
    setHolderName(savedName);
    setAccountNumber('');
    setEditing(true);
  }

  if (loading) {
    return <div className="rounded-2xl bg-card border border-border p-6 animate-pulse h-40" />;
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Payout Account</h3>
        {savedMethod && !editing && (
          <button
            onClick={handleEdit}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {/* Saved account view */}
      {savedMethod && !editing && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Method</span>
              <span className="text-sm font-medium text-foreground">{METHOD_LABEL[savedMethod]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Account Name</span>
              <span className="text-sm font-medium text-foreground">{savedName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Account Number</span>
              <span className="text-sm font-medium text-muted-foreground tracking-widest">••••••••••</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              {isVerified
                ? <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
                : <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Pending verification</span>
              }
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Account number is encrypted and cannot be displayed. Click Edit to update your details.
          </p>
        </div>
      )}

      {/* Edit / create form */}
      {editing && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Payout Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as PayoutMethod)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {PAYOUT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Account Holder Name</label>
            <input
              type="text"
              value={holderName}
              onChange={e => setHolderName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Full name as registered"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {method === 'PH_BANK' ? 'Bank Account Number' : 'Mobile Number'}
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={method === 'PH_BANK' ? 'Account number' : '09XXXXXXXXX'}
            />
          </div>

          <div className="flex gap-2">
            {savedMethod && (
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 border border-border rounded-lg py-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !holderName || !accountNumber}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : savedMethod ? 'Update Account' : 'Save Payout Account'}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Account details are encrypted and stored securely. They are never shared with third parties.
          </p>
        </div>
      )}
    </div>
  );
}
