import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260722000000_host_controlled_disbursements.sql",
  "utf8",
);

describe("host-controlled disbursement migration", () => {
  it("extends the disbursement_requests status CHECK to include manual-flow states", () => {
    expect(migration).toMatch(/ALTER TABLE\s+disbursement_requests[\s\S]*DROP CONSTRAINT[\s\S]*valid_disburse_status/);
    expect(migration).toMatch(/status IN \('pending','processing','completed','failed','retrying','awaiting_confirmation','released','rejected'\)/);
  });

  it("adds proof and audit columns", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS proof_image_path text");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS admin_note text");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS released_by uuid");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS released_at timestamptz");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS confirmed_at timestamptz");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS rejected_by uuid");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS rejected_at timestamptz");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS rejection_reason text");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS trigger text");
  });

  it("drops the one-payout-per-cycle unique constraint and adds an in-flight partial unique index", () => {
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS one_payout_per_wallet_per_cycle");
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uniq_disbursement_in_flight[\s\S]*WHERE status IN \('pending', 'awaiting_confirmation'\)/);
  });

  it("creates the disbursement-proofs storage bucket (private, image-only)", () => {
    expect(migration).toContain("'disbursement-proofs'");
    expect(migration).toContain("false");
    expect(migration).toContain("ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']");
  });

  it("adds RLS storage policies using has_role, not jwt claim", () => {
    expect(migration).toContain("Admins upload disbursement proofs");
    expect(migration).toContain("Admins read disbursement proofs");
    expect(migration).toContain("Hosts read own disbursement proofs");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin')");
    expect(migration).not.toMatch(/disbursement-proofs[\s\S]*auth\.jwt\(\)\s*->>\s*'role'/);
  });

  it("unschedules the monthly payout cron", () => {
    expect(migration).toContain("cron.unschedule('cheapstays-monthly-host-payouts')");
  });
});
