-- ============================================================
-- MIGRATION: Host Wallet System
-- CheapStays | APEX Business Systems Ltd.
-- ============================================================

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: host_wallets
-- One wallet per host. Never mutate directly from client.
-- ============================================================
CREATE TABLE IF NOT EXISTS host_wallets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00
    CONSTRAINT available_non_negative CHECK (available_balance >= 0),
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00
    CONSTRAINT pending_non_negative CHECK (pending_balance >= 0),
  currency        TEXT NOT NULL DEFAULT 'PHP',
  is_frozen       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_wallet_per_host UNIQUE (host_id)
);

-- ============================================================
-- TABLE: wallet_transactions
-- Immutable ledger. No updates. Only inserts.
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id             UUID NOT NULL REFERENCES host_wallets(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL
    CONSTRAINT valid_type CHECK (type IN ('credit_pending','release_to_available','debit_disbursement','admin_adjustment','debit_failed_reversal')),
  amount                NUMERIC(12,2) NOT NULL
    CONSTRAINT amount_positive CHECK (amount > 0),
  status                TEXT NOT NULL DEFAULT 'completed'
    CONSTRAINT valid_status CHECK (status IN ('completed','failed')),
  booking_id            UUID ON DELETE SET NULL,
  disbursement_id       UUID,
  xendit_reference_id   TEXT,
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: disbursement_requests
-- One payout request per processing cycle per wallet.
-- ============================================================
CREATE TABLE IF NOT EXISTS disbursement_requests (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id             UUID NOT NULL REFERENCES host_wallets(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL
    CONSTRAINT disbursement_amount_positive CHECK (amount > 0),
  status                TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT valid_disburse_status
      CHECK (status IN ('pending','processing','completed','failed','retrying')),
  payout_method         TEXT NOT NULL
    CONSTRAINT valid_payout_method CHECK (payout_method IN ('GCASH','MAYA','BCA','BNI','BRI','MANDIRI','PH_BANK')),
  account_details_enc   BYTEA NOT NULL,
  xendit_disbursement_id TEXT,
  xendit_reference_id   TEXT,
  failure_reason        TEXT,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  retry_after           TIMESTAMPTZ,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  cycle_month           TEXT NOT NULL,
  CONSTRAINT one_payout_per_wallet_per_cycle UNIQUE (wallet_id, cycle_month)
);

-- ============================================================
-- TABLE: host_payout_accounts
-- Encrypted payout method per host. Editable unless processing.
-- ============================================================
CREATE TABLE IF NOT EXISTS host_payout_accounts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method     TEXT NOT NULL
    CONSTRAINT valid_method CHECK (payout_method IN ('GCASH','MAYA','PH_BANK')),
  account_holder_name TEXT NOT NULL,
  account_number_enc  BYTEA NOT NULL,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_payout_account_per_host UNIQUE (host_id)
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER host_wallets_updated_at
  BEFORE UPDATE ON host_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER host_payout_accounts_updated_at
  BEFORE UPDATE ON host_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_host_wallets_host_id ON host_wallets(host_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_booking_id ON wallet_transactions(booking_id);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_disbursement_requests_wallet_id ON disbursement_requests(wallet_id);
CREATE INDEX idx_disbursement_requests_status ON disbursement_requests(status);
CREATE INDEX idx_disbursement_requests_cycle ON disbursement_requests(cycle_month);
CREATE INDEX idx_host_payout_accounts_host_id ON host_payout_accounts(host_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE host_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disbursement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_payout_accounts ENABLE ROW LEVEL SECURITY;

-- host_wallets: host sees own, admin sees all, no client mutation
CREATE POLICY "host_wallet_select_own"
  ON host_wallets FOR SELECT
  USING (auth.uid() = host_id);

CREATE POLICY "host_wallet_admin_all"
  ON host_wallets FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- wallet_transactions: host reads own, immutable from client
CREATE POLICY "wallet_tx_select_own"
  ON wallet_transactions FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM host_wallets WHERE host_id = auth.uid()
    )
  );

CREATE POLICY "wallet_tx_admin_all"
  ON wallet_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- disbursement_requests: host reads own, admin all
CREATE POLICY "disbursement_select_own"
  ON disbursement_requests FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM host_wallets WHERE host_id = auth.uid()
    )
  );

CREATE POLICY "disbursement_admin_all"
  ON disbursement_requests FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- host_payout_accounts: host manages own, admin all
CREATE POLICY "payout_account_own"
  ON host_payout_accounts FOR ALL
  USING (auth.uid() = host_id);

CREATE POLICY "payout_account_admin_all"
  ON host_payout_accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- pg_cron: Monthly payout job (1st of month, 9 AM Manila = 1 AM UTC)
-- ============================================================
SELECT cron.schedule(
  'cheapstays-monthly-host-payouts',
  '0 1 1 * *',
  \$\$ SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/process-monthly-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ); \$\$
);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
