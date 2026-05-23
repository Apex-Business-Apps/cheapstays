import { supabase } from "@/integrations/supabase/client";

export type HostApprovalInput = {
  applicationId: string;
  targetUserId: string;
  reviewerId?: string;
  approve: boolean;
  reason?: string;
};

export async function submitHostApplicationDecision(input: HostApprovalInput) {
  if (input.approve) {
    const { error } = await supabase.functions.invoke("approve-host-application", {
      body: {
        application_id: input.applicationId,
        target_user_id: input.targetUserId,
        reason_code: "host-application-approved",
        reviewer_notes: "Approved in admin host application review.",
      },
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("host_applications")
    .update({
      status: "rejected", // keep explicit rejected transition for moderation traceability
      reviewed_by: input.reviewerId,
      reviewed_at: new Date().toISOString(),
      ...(input.reason ? { rejection_reason: input.reason } : {}),
    })
    .eq("id", input.applicationId);

  if (error) throw error;
}
