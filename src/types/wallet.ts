export type PayoutMethod = 'GCASH' | 'MAYA' | 'PH_BANK';

export type WalletTransactionType =
  | 'credit_pending'
  | 'release_to_available'
  | 'debit_disbursement'
  | 'admin_adjustment'
  | 'debit_failed_reversal';

export type DisbursementStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying';

export interface HostWallet {
  id: string;
  host_id: string;
  available_balance: number;
  pending_balance: number;
  currency: string;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: number;
  status: 'completed' | 'failed';
  booking_id: string | null;
  disbursement_id: string | null;
  xendit_reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface DisbursementRequest {
  id: string;
  wallet_id: string;
  amount: number;
  status: DisbursementStatus;
  payout_method: PayoutMethod;
  xendit_disbursement_id: string | null;
  failure_reason: string | null;
  retry_count: number;
  retry_after: string | null;
  requested_at: string;
  processed_at: string | null;
  cycle_month: string;
}

export interface HostPayoutAccount {
  id: string;
  host_id: string;
  payout_method: PayoutMethod;
  account_holder_name: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}
