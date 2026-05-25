import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type LegalFastAcceptRequest = {
  userId: string;
  role: string;
  contextId: string;
  documentId: string;
  documentVersion: string;
  documentHash: string;
  changedTopics?: string[];
};

export type LegalFastAcceptEligibility = {
  eligible: boolean;
  requires_full_scroll: boolean;
  reason: string;
  last_acceptance_id: string | null;
  accepted_at: string | null;
};

export async function getLegalFastAcceptEligibility(input: LegalFastAcceptRequest): Promise<LegalFastAcceptEligibility> {
  const { data, error } = await supabase.rpc("legal_fast_accept_eligible", {
    p_user_id: input.userId,
    p_role: input.role,
    p_context_id: input.contextId,
    p_document_id: input.documentId,
    p_document_version: input.documentVersion,
    p_document_hash: input.documentHash,
    p_changed_topics: input.changedTopics ?? [],
  });

  if (error) throw error;
  const row = (data?.[0] as LegalFastAcceptEligibility | undefined) ?? null;
  if (!row) {
    return {
      eligible: false,
      requires_full_scroll: true,
      reason: "missing_eligibility_result",
      last_acceptance_id: null,
      accepted_at: null,
    };
  }

  return row;
}

export async function createLegalAcceptanceAudit(params: {
  userId: string;
  role: string;
  contextId: string;
  documentId: string;
  documentVersion: string;
  documentHash: string;
  checkboxLabel: string;
  scrolledToBottom: boolean;
  gateOpenedAt: string;
  scrollCompletedAt: string | null;
  metadata?: Json;
}) {
  const { error } = await supabase.from("legal_consent_acceptances").insert({
    user_id: params.userId,
    role: params.role,
    context_id: params.contextId,
    document_id: params.documentId,
    document_version: params.documentVersion,
    document_hash: params.documentHash,
    checkbox_label: params.checkboxLabel,
    scrolled_to_bottom: params.scrolledToBottom,
    gate_opened_at: params.gateOpenedAt,
    scroll_completed_at: params.scrollCompletedAt,
    metadata: params.metadata ?? {},
  });

  if (error) throw error;
}

export async function hasRequiredSignupConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("legal_consent_acceptances")
    .select("document_id")
    .eq("user_id", userId)
    .eq("context_id", "signup")
    .in("document_id", ["terms", "privacy"]);
  if (error) throw error;
  const docs = new Set((data ?? []).map((row) => row.document_id));
  return docs.has("terms") && docs.has("privacy");
}
