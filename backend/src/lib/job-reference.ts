/** Human-readable repair serial — backed by Job.jobNumber (DB autoincrement) */
export function formatJobReference(jobNumber: number): string {
  return `EB-${String(jobNumber).padStart(6, "0")}`;
}

export function parseJobReference(ref: string): number | null {
  const trimmed = ref.trim().toUpperCase();
  const match = trimmed.match(/^EB-?(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function withJobReference<T extends { jobNumber: number }>(job: T) {
  return { ...job, jobReference: formatJobReference(job.jobNumber) };
}

export function withJobReferences<T extends { jobNumber: number }>(jobs: T[]) {
  return jobs.map(withJobReference);
}