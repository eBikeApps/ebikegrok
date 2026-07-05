/** Matches backend formatJobReference — serial from Job.jobNumber */
export function formatJobReference(jobNumber: number | undefined | null): string {
  if (jobNumber == null || !Number.isFinite(jobNumber)) return '';
  return `EB-${String(jobNumber).padStart(6, '0')}`;
}

export function formatJobReferenceLabel(
  jobNumber: number | undefined | null,
  language: 'he' | 'en' = 'he'
): string {
  const ref = formatJobReference(jobNumber);
  if (!ref) return '';
  return language === 'he' ? `תיקון ${ref}` : `Repair ${ref}`;
}