import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Database, Tables, TablesInsert, TablesUpdate } from '../database.types';

type User = Tables<'users'>;
type TechnicianProfile = Tables<'technician_profiles'>;
type Job = Tables<'jobs'>;

// =============================================
// TECHNICIANS
// =============================================

export interface TechnicianWithUser extends TechnicianProfile {
  user: User;
  distance?: number;
  eta?: number;
}

export function useAvailableTechnicians(userLat?: number, userLng?: number) {
  return useQuery({
    queryKey: ['technicians', 'available', userLat, userLng],
    queryFn: async (): Promise<TechnicianWithUser[]> => {
      const { data, error } = await supabase
        .from('technician_profiles')
        .select(`
          *,
          user:users(*)
        `)
        .eq('is_available', true)
        .eq('verification_status', 'verified');

      if (error) throw error;
      if (!data) return [];

      // Transform and calculate distance if user location is provided
      const technicians: TechnicianWithUser[] = data.map((tech) => ({
        ...tech,
        user: tech.user as unknown as User,
      }));

      if (userLat && userLng) {
        return technicians
          .map((tech) => {
            if (tech.current_lat && tech.current_lng) {
              const distance = calculateDistance(
                userLat,
                userLng,
                tech.current_lat,
                tech.current_lng
              );
              const eta = Math.ceil((distance / 25) * 60) + 5; // 25 km/h average + 5 min prep
              return { ...tech, distance, eta };
            }
            return tech;
          })
          .filter((tech) => !tech.distance || tech.distance <= 10) // Within 10km
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      return technicians;
    },
    enabled: true,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useTechnicianProfile(userId: string) {
  return useQuery({
    queryKey: ['technician', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technician_profiles')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return {
        ...data,
        user: data.user as unknown as User,
      } as TechnicianWithUser;
    },
    enabled: !!userId,
  });
}

export function useUpdateTechnicianLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      lat,
      lng,
    }: {
      userId: string;
      lat: number;
      lng: number;
    }) => {
      const { error } = await supabase
        .from('technician_profiles')
        .update({
          current_lat: lat,
          current_lng: lng,
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
}

export function useUpdateTechnicianAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      isAvailable,
    }: {
      userId: string;
      isAvailable: boolean;
    }) => {
      const { error } = await supabase
        .from('technician_profiles')
        .update({ is_available: isAvailable })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
}

// =============================================
// JOBS
// =============================================

export interface JobWithCustomer extends Job {
  customer: User;
}

export interface JobWithTechnician extends Job {
  technician: User | null;
}

export interface JobWithBoth extends Job {
  customer: User;
  technician: User | null;
}

export function useCustomerJobs(customerId: string) {
  return useQuery({
    queryKey: ['jobs', 'customer', customerId],
    queryFn: async (): Promise<JobWithTechnician[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          technician:users!jobs_technician_id_fkey(*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((job) => ({
        ...job,
        technician: job.technician as unknown as User | null,
      }));
    },
    enabled: !!customerId,
  });
}

export function useTechnicianJobs(technicianId: string) {
  return useQuery({
    queryKey: ['jobs', 'technician', technicianId],
    queryFn: async (): Promise<JobWithCustomer[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:users!jobs_customer_id_fkey(*)
        `)
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((job) => ({
        ...job,
        customer: job.customer as unknown as User,
      }));
    },
    enabled: !!technicianId,
  });
}

export function useActiveJob(jobId: string) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async (): Promise<JobWithBoth> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:users!jobs_customer_id_fkey(*),
          technician:users!jobs_technician_id_fkey(*)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return {
        ...data,
        customer: data.customer as unknown as User,
        technician: data.technician as unknown as User | null,
      };
    },
    enabled: !!jobId,
    refetchInterval: 10000, // Refresh every 10 seconds for tracking
  });
}

export function usePendingJobs(techLat?: number, techLng?: number) {
  return useQuery({
    queryKey: ['jobs', 'pending', techLat, techLng],
    queryFn: async (): Promise<(JobWithCustomer & { distance?: number })[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:users!jobs_customer_id_fkey(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const jobs = (data || []).map((job) => ({
        ...job,
        customer: job.customer as unknown as User,
      }));

      // Filter by distance if technician location provided
      if (techLat && techLng) {
        return jobs.filter((job) => {
          const distance = calculateDistance(
            techLat,
            techLng,
            job.customer_lat,
            job.customer_lng
          );
          return distance <= 15; // Within 15km
        }).map((job) => ({
          ...job,
          distance: calculateDistance(techLat, techLng, job.customer_lat, job.customer_lng),
        }));
      }

      return jobs;
    },
    enabled: true,
    refetchInterval: 10000, // Check for new jobs every 10 seconds
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: TablesInsert<'jobs'>) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert(job)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      status,
      additionalData,
    }: {
      jobId: string;
      status: Job['status'];
      additionalData?: TablesUpdate<'jobs'>;
    }) => {
      const updateData: TablesUpdate<'jobs'> = {
        status,
        ...additionalData,
      };

      // Set timestamp based on status
      if (status === 'accepted') updateData.accepted_at = new Date().toISOString();
      if (status === 'arrived') updateData.arrived_at = new Date().toISOString();
      if (status === 'in_progress') updateData.started_at = new Date().toISOString();
      if (status === 'completed') updateData.completed_at = new Date().toISOString();
      if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
    },
  });
}

export function useAcceptJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      technicianId,
      techLat,
      techLng,
    }: {
      jobId: string;
      technicianId: string;
      techLat?: number;
      techLng?: number;
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({
          technician_id: technicianId,
          status: 'accepted' as const,
          accepted_at: new Date().toISOString(),
          technician_lat: techLat,
          technician_lng: techLng,
        })
        .eq('id', jobId)
        .eq('status', 'pending'); // Only accept if still pending

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCompleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      finalPrice,
      parts,
      paymentMethod,
      technicianNotes,
    }: {
      jobId: string;
      finalPrice: number;
      parts?: Array<{ name: string; price: number }>;
      paymentMethod: 'cash' | 'card';
      technicianNotes?: string;
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          final_price: finalPrice,
          parts: parts as unknown as Database['public']['Tables']['jobs']['Update']['parts'],
          payment_method: paymentMethod,
          technician_notes: technicianNotes,
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useRateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      customerId,
      technicianId,
      rating,
      categories,
      feedback,
    }: {
      jobId: string;
      customerId: string;
      technicianId: string;
      rating: number;
      categories?: Record<string, boolean>;
      feedback?: string;
    }) => {
      // Update job with rating
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          rating,
          rating_categories: categories as unknown as Database['public']['Tables']['jobs']['Update']['rating_categories'],
          feedback,
        })
        .eq('id', jobId);

      if (jobError) throw jobError;

      // Create review record
      const { error: reviewError } = await supabase.from('reviews').insert({
        job_id: jobId,
        customer_id: customerId,
        technician_id: technicianId,
        rating,
        categories: categories as unknown as Database['public']['Tables']['reviews']['Insert']['categories'],
        feedback,
      });

      if (reviewError) throw reviewError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
}

// =============================================
// REALTIME SUBSCRIPTIONS
// =============================================

export function subscribeToJob(jobId: string, callback: (job: Job) => void) {
  return supabase
    .channel(`job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload) => {
        callback(payload.new as Job);
      }
    )
    .subscribe();
}

export function subscribeToPendingJobs(
  callback: (job: Job) => void
) {
  return supabase
    .channel('pending-jobs')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: 'status=eq.pending',
      },
      (payload) => {
        callback(payload.new as Job);
      }
    )
    .subscribe();
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
