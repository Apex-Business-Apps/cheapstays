// Shared colour mapping for application status badges across the admin surface.
// Pending → amber, Approved → emerald, Rejected → red, All/other → neutral.

export type ApplicationBucket = "pending" | "approved" | "rejected" | "all";

export function kycBucket(status: string): ApplicationBucket {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

export function ticketBucket(status: string): ApplicationBucket {
  if (status === "resolved") return "approved";
  if (status === "closed") return "rejected";
  return "pending";
}

export function bucketBadgeClass(bucket: ApplicationBucket): string {
  switch (bucket) {
    case "approved":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20";
    case "rejected":
      return "border-transparent bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-500/20";
    case "pending":
      return "border-transparent bg-amber-400/20 text-amber-800 dark:text-amber-200 hover:bg-amber-400/30";
    default:
      return "border-transparent bg-muted text-foreground";
  }
}
