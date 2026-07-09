import { api } from '@/lib/api/api';
import { authClient } from '@/lib/auth/auth-client';
import { useActiveJobStore } from '@/lib/store';
import { Job, JobStatus } from '@/lib/types';
import { shouldSkipCompletionScreen } from '@/lib/completion-flow';
import { parseJobCategories } from '@/lib/job-categories';

const TERMINAL_STATUSES: JobStatus[] = ['completed', 'cancelled'];

export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as JobStatus);
}

/** Map backend job row → customer active-job store shape (incl. payment_status). */
export function mapDbJobToCustomerJob(dbJob: any): Job {
  return {
    id: dbJob.id,
    job_number: dbJob.jobNumber,
    job_reference: dbJob.jobReference,
    customer_id: dbJob.customerId,
    technician_id: dbJob.technicianId,
    status: dbJob.status,
    photo_url: dbJob.photoUrl ?? '',
    description: dbJob.description ?? '',
    bike_type: dbJob.bikeType,
    categories: parseJobCategories(dbJob.category, dbJob.categories),
    estimated_price_min: dbJob.estimatedPriceMin ?? 0,
    estimated_price_max: dbJob.estimatedPriceMax ?? 0,
    customer_location: {
      latitude: dbJob.customerLocationLat,
      longitude: dbJob.customerLocationLng,
      address: dbJob.customerAddress ?? undefined,
    },
    technician_location:
      dbJob.technicianLocationLat && dbJob.technicianLocationLng
        ? { latitude: dbJob.technicianLocationLat, longitude: dbJob.technicianLocationLng }
        : undefined,
    payment_status: dbJob.paymentStatus ?? 'pending',
    final_price: dbJob.finalPrice ?? undefined,
    created_at: dbJob.createdAt,
    accepted_at: dbJob.acceptedAt ?? undefined,
    on_way_at: dbJob.onWayAt ?? undefined,
    arrived_at: dbJob.arrivedAt ?? undefined,
    in_progress_at: dbJob.inProgressAt ?? undefined,
    completed_at: dbJob.completedAt ?? undefined,
    cancelled_at: dbJob.cancelledAt ?? undefined,
    customer: dbJob.customer
      ? {
          id: dbJob.customer.id,
          name: dbJob.customer.name,
          email: dbJob.customer.email ?? '',
          phone: dbJob.customer.phone ?? '',
          avatar_url: dbJob.customer.image ?? '',
          role: 'customer' as const,
          saved_addresses: [],
          created_at: dbJob.customer.createdAt ?? new Date().toISOString(),
          updated_at: dbJob.customer.updatedAt ?? new Date().toISOString(),
        }
      : undefined,
    technician: dbJob.technician
      ? {
          id: dbJob.technician.id,
          name: dbJob.technician.name,
          email: dbJob.technician.email ?? '',
          phone: dbJob.technician.phone ?? '',
          avatar_url: dbJob.technician.image ?? '',
          role: 'technician' as const,
          rating: dbJob.technician.rating ?? 0,
          total_reviews: dbJob.technician.totalReviews ?? 0,
          verification_status: 'verified' as const,
          vehicle_type: dbJob.technician.vehicleType ?? '',
          service_radius: 10,
          is_available: true,
          base_price: dbJob.technician.basePrice ?? 0,
          total_earnings: 0,
          current_location:
            dbJob.technician.currentLocationLat && dbJob.technician.currentLocationLng
              ? {
                  latitude: dbJob.technician.currentLocationLat,
                  longitude: dbJob.technician.currentLocationLng,
                }
              : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : undefined,
  } as Job;
}

export function clearCustomerActiveJobState(): void {
  useActiveJobStore.getState().setActiveJob(null);
  useActiveJobStore.getState().setTechnicianLocation(null);
}

/** Fetch the customer's single in-progress job from the server (source of truth). */
export async function fetchCustomerActiveJob(): Promise<Job | null> {
  const session = await authClient.getSession();
  const token = (session as any)?.data?.session?.token;
  if (!token) return null;

  const res = await fetch(
    `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/customer/active`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.job) return null;
  if (isTerminalJobStatus(data.job.status)) return null;
  return mapDbJobToCustomerJob(data.job);
}

export async function fetchJobById(jobId: string): Promise<Job | null> {
  try {
    const result = await api.get<{ job: any }>(`/api/jobs/${jobId}`);
    if (!result.job) return null;
    return mapDbJobToCustomerJob(result.job);
  } catch {
    return null;
  }
}

async function fetchJobByIdWithRetry(jobId: string, attempts = 3): Promise<Job | null> {
  for (let i = 0; i < attempts; i++) {
    const job = await fetchJobById(jobId);
    if (job) return job;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}

export type JobEntryResolution =
  | { action: 'home' }
  | { action: 'complete'; jobId: string }
  | { action: 'track'; job: Job };

/**
 * Decide what to do when opening job-tracking for a given id.
 * Prevents resurrecting finished/dismissed orders after app restart.
 */
export async function resolveJobTrackingEntry(
  jobId: string,
  localJob?: Job | null
): Promise<JobEntryResolution> {
  if (!jobId) return { action: 'home' };

  let job = await fetchJobByIdWithRetry(jobId);

  // Fresh booking: store already has the job before the server round-trip finishes
  if (!job && localJob?.id === jobId && !isTerminalJobStatus(localJob.status)) {
    job = localJob;
  }

  if (!job) return { action: 'home' };

  if (job.status === 'completed') {
    if (await shouldSkipCompletionScreen(jobId)) {
      return { action: 'home' };
    }
    return { action: 'complete', jobId };
  }
  if (job.status === 'cancelled') {
    return { action: 'home' };
  }

  return { action: 'track', job };
}