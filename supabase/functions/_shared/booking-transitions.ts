// Shared helpers for booking state mutation. Every edge function that
// touches bookings.flow_state must use these helpers — direct UPDATEs of
// state-bearing columns are blocked by the bookings_guard_critical_columns
// trigger for any non-service-role caller.

import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type FlowState =
  | "payment_pending"
  | "requested"
  | "approved"
  | "auto_approved"
  | "active"
  | "cancel_requested"
  | "replacement_offered"
  | "replacement_accepted"
  | "refunded"
  | "completed"
  | "expired";

export type CoarseStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type ActorRole = "guest" | "host" | "admin" | "system" | "scheduler";

/** Locked-decision mapping from flow_state to coarse legacy booking.status. */
export function flowToCoarseStatus(flow: FlowState): CoarseStatus {
  switch (flow) {
    case "payment_pending":
      return "pending";
    case "requested":
    case "approved":
    case "auto_approved":
      return "pending";
    case "active":
    case "cancel_requested":
    case "replacement_offered":
    case "replacement_accepted":
      return "confirmed";
    case "refunded":
    case "expired":
      return "cancelled";
    case "completed":
      return "completed";
  }
}

export interface RecordTransitionParams {
  bookingId: string;
  fromState: FlowState | null;
  toState: FlowState;
  actorUserId: string | null;
  actorRole: ActorRole;
  reason: string;
  metadata?: Record<string, unknown>;
}

/** Append a booking_transitions row. Caller must use a service-role client. */
export async function recordTransition(
  adminClient: SupabaseClient,
  params: RecordTransitionParams,
): Promise<void> {
  const { error } = await adminClient.from("booking_transitions").insert({
    booking_id: params.bookingId,
    from_state: params.fromState,
    to_state: params.toState,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    reason: params.reason,
    metadata: params.metadata ?? {},
  });
  if (error) {
    // Transition audit failure is a hard error — without it we lose history.
    throw new Error(`failed to record booking transition: ${error.message}`);
  }
}

/** Set of legal forward transitions, enforced in edge functions. */
const ALLOWED_TRANSITIONS: Record<FlowState, FlowState[]> = {
  payment_pending:        ["active", "expired", "cancel_requested"],
  requested:              ["approved", "auto_approved", "expired", "cancel_requested"],
  approved:               ["active", "cancel_requested"],
  auto_approved:          ["active", "cancel_requested"],
  active:                 ["cancel_requested", "replacement_offered", "completed"],
  cancel_requested:       ["refunded", "active"],
  replacement_offered:    ["replacement_accepted", "active", "cancel_requested"],
  replacement_accepted:   ["active", "cancel_requested"],
  refunded:               [],
  completed:              [],
  expired:                [],
};

export function isTransitionAllowed(from: FlowState, to: FlowState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
