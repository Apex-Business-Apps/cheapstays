import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260722000000_host_controlled_disbursements.sql",
  "utf8",
);

const walletTypes = readFileSync("src/types/wallet.ts", "utf8");

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

  it("adds the new disbursement statuses to the DisbursementStatus union", () => {
    expect(walletTypes).toContain("'awaiting_confirmation'");
    expect(walletTypes).toContain("'released'");
    expect(walletTypes).toContain("'rejected'");
  });

  it("adds proof and audit fields to DisbursementRequest", () => {
    expect(walletTypes).toContain("proof_image_path: string | null");
    expect(walletTypes).toContain("admin_note: string | null");
    expect(walletTypes).toContain("released_by: string | null");
    expect(walletTypes).toContain("released_at: string | null");
    expect(walletTypes).toContain("confirmed_at: string | null");
    expect(walletTypes).toContain("rejected_by: string | null");
    expect(walletTypes).toContain("rejected_at: string | null");
    expect(walletTypes).toContain("rejection_reason: string | null");
    expect(walletTypes).toContain("trigger: 'manual' | 'auto'");
  });
});

const requestFn = readFileSync("supabase/functions/request-disbursement/index.ts", "utf8");

describe("request-disbursement edge function", () => {
  it("returns CORS headers on OPTIONS", () => {
    expect(requestFn).toContain('if (req.method === "OPTIONS")');
    expect(requestFn).toContain("corsHeaders");
  });

  it("uses getUserFromRequest for auth", () => {
    expect(requestFn).toContain("getUserFromRequest(req)");
  });

  it("awaits the rate limit and uses a 7-day window keyed by user id", () => {
    expect(requestFn).toMatch(/const rl = await rateLimit\(`request-disbursement:\$\{user\.id\}`,\s*1,\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\)/);
  });

  it("enforces the ₱500 minimum", () => {
    expect(requestFn).toContain("const MINIMUM_PAYOUT = 500");
    expect(requestFn).toContain("available_balance < MINIMUM_PAYOUT");
  });

  it("blocks when the payout account is not verified", () => {
    expect(requestFn).toContain("is_verified");
    expect(requestFn).toContain("Payout account not verified");
  });

  it("blocks when an in-flight request already exists", () => {
    expect(requestFn).toContain("status.in.(pending,awaiting_confirmation)");
    expect(requestFn).toContain("A disbursement request is already in progress");
  });

  it("debits the wallet before returning success (write order matters)", () => {
    const insertIdx = requestFn.indexOf('.from("disbursement_requests")');
    const debitIdx = requestFn.indexOf("available_balance: 0");
    const returnIdx = requestFn.indexOf('"ok": true');
    expect(insertIdx).toBeGreaterThan(-1);
    expect(debitIdx).toBeGreaterThan(insertIdx);
    expect(returnIdx).toBeGreaterThan(debitIdx);
  });

  it("dispatches an in-app notification to every admin", () => {
    expect(requestFn).toContain('type: "disbursement_requested"');
    expect(requestFn).toContain('.from("user_roles")');
    expect(requestFn).toContain('.eq("role", "admin")');
  });
});

const attachFn = readFileSync("supabase/functions/admin-attach-disbursement-proof/index.ts", "utf8");

describe("admin-attach-disbursement-proof edge function", () => {
  it("returns CORS headers on OPTIONS", () => {
    expect(attachFn).toContain('if (req.method === "OPTIONS")');
  });

  it("verifies caller is admin via has_role RPC", () => {
    expect(attachFn).toContain('.rpc("has_role"');
    expect(attachFn).toContain('_role: "admin"');
  });

  it("validates required fields disbursement_id and proof_image_path", () => {
    expect(attachFn).toContain("disbursement_id");
    expect(attachFn).toContain("proof_image_path");
    expect(attachFn).toContain('return json(400');
  });

  it("only accepts requests in pending status", () => {
    expect(attachFn).toContain('status !== "pending"');
    expect(attachFn).toContain("Request is not pending");
  });

  it("sets awaiting_confirmation, records released_by and released_at", () => {
    expect(attachFn).toContain('status: "awaiting_confirmation"');
    expect(attachFn).toContain("released_by: user.id");
    expect(attachFn).toContain("released_at:");
  });

  it("notifies the host that proof was uploaded", () => {
    expect(attachFn).toContain('type: "disbursement_proof_uploaded"');
  });

  it("awaits the rate limit", () => {
    expect(attachFn).toMatch(/const rl = await rateLimit/);
  });
});

const rejectFn = readFileSync("supabase/functions/admin-reject-disbursement/index.ts", "utf8");

describe("admin-reject-disbursement edge function", () => {
  it("verifies caller is admin", () => {
    expect(rejectFn).toContain('.rpc("has_role"');
  });

  it("requires a rejection_reason", () => {
    expect(rejectFn).toContain("rejection_reason");
    expect(rejectFn).toContain('return json(400');
  });

  it("allows rejection only from pending or awaiting_confirmation", () => {
    expect(rejectFn).toMatch(/\!\["pending",\s*"awaiting_confirmation"\]\.includes\(/);
  });

  it("refunds the wallet using available_balance + amount", () => {
    expect(rejectFn).toContain("available_balance:");
    expect(rejectFn).toContain('type: "debit_failed_reversal"');
  });

  it("notifies the host with the rejection reason", () => {
    expect(rejectFn).toContain('type: "disbursement_rejected"');
  });
});

const confirmFn = readFileSync("supabase/functions/host-confirm-disbursement/index.ts", "utf8");

describe("host-confirm-disbursement edge function", () => {
  it("verifies the caller owns the wallet on the request", () => {
    expect(confirmFn).toContain("host_id");
    expect(confirmFn).toContain("!== user.id");
  });

  it("only transitions from awaiting_confirmation", () => {
    expect(confirmFn).toContain('status !== "awaiting_confirmation"');
  });

  it("sets status=released and confirmed_at", () => {
    expect(confirmFn).toContain('status: "released"');
    expect(confirmFn).toContain("confirmed_at:");
  });

  it("dispatches disbursement_released notification to the host", () => {
    expect(confirmFn).toContain('type: "disbursement_released"');
  });
});
