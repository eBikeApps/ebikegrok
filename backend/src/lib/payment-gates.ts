// Pure decision helpers for the "customer pays AFTER technician accepts and BEFORE technician drives (on_way)" rule.
// These are the source of truth for the gates. Tested first (TDD), then wired into routes.

export type JobLikeForPayment = {
  id: string;
  status: string; // pending | accepted | on_way | ...
  paymentStatus: string; // pending | paid | ...
};

/**
 * Can the customer create a payment page for this job?
 * Rule (user spec + Slice 1): ONLY after the technician has accepted (status=accepted) and not yet paid.
 * Prevents paying on pending/cancelled/completed, or double-paying.
 */
export function canCreatePayment(job: JobLikeForPayment | null): { ok: boolean; error?: string } {
  if (!job) {
    return { ok: false, error: "Job not found" };
  }
  if (job.status !== "accepted") {
    return { ok: false, error: "Payment is only allowed after a technician accepts the job" };
  }
  if (job.paymentStatus === "paid") {
    return { ok: false, error: "This job is already paid" };
  }
  // Also block if terminal (defensive)
  if (["completed", "cancelled"].includes(job.status)) {
    return { ok: false, error: "Cannot pay for a completed or cancelled job" };
  }
  return { ok: true };
}

/**
 * Can the assigned technician transition this job to "on_way" (drive to customer)?
 * Rule (user spec): Must be currently accepted AND the customer has paid.
 * Uses the same atomic-friendly predicate as the webhook claims.
 */
export function canTransitionToOnWay(job: JobLikeForPayment | null): { ok: boolean; error?: string } {
  if (!job) {
    return { ok: false, error: "Job not found" };
  }
  if (job.status !== "accepted") {
    return { ok: false, error: "Job must be in accepted state" };
  }
  if (job.paymentStatus !== "paid") {
    return { ok: false, error: "Customer must pay after technician accepts before the technician can drive to the customer" };
  }
  return { ok: true };
}