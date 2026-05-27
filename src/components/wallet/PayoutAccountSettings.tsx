import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PayoutMethod } from '@/types/wallet';

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'GCASH', label: 'GCash' },
  { value: 'MAYA', label: 'Maya' },
  { value: 'PH_BANK', label: 'Philippine Bank Account' }
];

export function PayoutAccountSettings() {
  const [method, setMethod] = useState<PayoutMethod>('GCASH');
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('host_payout_accounts').select('payout_method, account_holder_name, is_verified').single()
      .then(({ data }) => {
        if (data) {
          setMethod(data.payout_method as PayoutMethod);
          setHolderName(data.account_holder_name);
          setHasExisting(true);
        }
      });
  }, []);

  async function handleSave() {
    if (!holderName || !accountNumber) return;
    setSaving(true);

    // Encrypt account number via edge function call
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-payout-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payout_method: method, account_holder_name: holderName, account_number: accountNumber })
    });

    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
      <h3 className="font-semibold text-foreground">Payout Account</h3>
      {hasExisting && (
        <p className="text-xs text-muted-foreground">
          Account on file. Update only if your details have changed.
        </p>
      )}

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
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !holderName || !accountNumber}
        className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Payout Account'}
      </button>

      <p className="text-xs text-muted-foreground">
        Account details are encrypted and stored securely. They are never shared with third parties.
      </p>
    </div>
  );
}
