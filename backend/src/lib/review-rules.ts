export type ReviewJobSnapshot = {
  customerId: string;
  technicianId: string | null;
  status: string;
};

export type ReviewGate =
  | { ok: true; technicianId: string }
  | { ok: false; status: 400 | 403 | 404 | 409; message: string };

/**
 * A customer may review the assigned technician only after that job's repair
 * is completed, and only once. Cancelled, refunded, and in-progress jobs are refused.
 */
export function reviewGate(input: {
  role: string | null | undefined;
  userId: string;
  job: ReviewJobSnapshot | null;
  alreadyReviewed: boolean;
}): ReviewGate {
  if (input.role !== "customer") {
    return { ok: false, status: 403, message: "רק לקוח יכול להשאיר ביקורת" };
  }
  if (!input.job) {
    return { ok: false, status: 404, message: "ההזמנה לא נמצאה" };
  }
  if (input.job.customerId !== input.userId) {
    return { ok: false, status: 403, message: "אין הרשאה להשאיר ביקורת על ההזמנה הזו" };
  }
  if (input.job.status !== "completed") {
    return { ok: false, status: 400, message: "אפשר להשאיר ביקורת רק אחרי שהתיקון הושלם" };
  }
  if (!input.job.technicianId) {
    return { ok: false, status: 400, message: "אין טכנאי משויך לתיקון הזה" };
  }
  if (input.alreadyReviewed) {
    return { ok: false, status: 409, message: "כבר השארת ביקורת על התיקון הזה" };
  }
  return { ok: true, technicianId: input.job.technicianId };
}
