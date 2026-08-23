-- Fix the host payout account encryption pipeline.
--
-- Two bugs made every existing host_payout_accounts.account_number_enc row
-- unrecoverable:
--
--   1. supabase/functions/_shared/encryption.ts hexToBytes() used
--      hex.substring(i, 2) instead of hex.substring(i, i + 2), so the derived
--      AES key was effectively 32 zero-bytes (plus one real byte). Fixed in
--      code.
--
--   2. encrypt() returns a base64 STRING but the column was BYTEA, so
--      PostgREST round-tripped the string through bytea encoding and callers
--      read back "\x<hex>" instead of the original base64 — decrypt() then
--      choked on atob().
--
-- Since existing ciphertext was written with a garbage key AND mangled by the
-- bytea round-trip, it cannot be decrypted. We wipe the rows and require
-- hosts to re-enter their payout account. Verification state is cleared so no
-- disbursement can go out against orphaned data.

-- Wipe unrecoverable rows first (before the type change would fail on cast).
DELETE FROM public.host_payout_accounts;

-- Base64 fits comfortably in TEXT and avoids the PostgREST bytea reformat.
ALTER TABLE public.host_payout_accounts
  ALTER COLUMN account_number_enc TYPE TEXT USING NULL;

ALTER TABLE public.host_payout_accounts
  ALTER COLUMN account_number_enc SET NOT NULL;

-- disbursement_requests snapshots the account_number_enc at request time
-- into account_details_enc (see supabase/functions/request-disbursement).
-- Same bytea/base64 mismatch — future writes must land in a TEXT column.
-- Existing rows keep their (unrecoverable) bytea-encoded bytes coerced to
-- text; admin ops now read live from host_payout_accounts via
-- admin-get-payout-account, not from this snapshot, so no admin flow depends
-- on decrypting the historical values.
ALTER TABLE public.disbursement_requests
  ALTER COLUMN account_details_enc TYPE TEXT USING encode(account_details_enc, 'escape');
