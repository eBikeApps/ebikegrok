import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api/api';

const KEY_PREFIX = 'job_completion_dismissed:';

export async function markJobCompletionDismissed(jobId: string): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${jobId}`, '1');
}

/** Call when customer is done with a job (rated, skipped, or order finished). */
export async function markActiveJobFlowFinished(jobId: string): Promise<void> {
  await markJobCompletionDismissed(jobId);
}

export async function isJobCompletionDismissed(jobId: string): Promise<boolean> {
  const v = await AsyncStorage.getItem(`${KEY_PREFIX}${jobId}`);
  return v === '1';
}

export async function jobHasReview(jobId: string): Promise<boolean> {
  try {
    const data = await api.get<{ review: unknown | null }>(`/api/reviews/job/${jobId}`);
    return !!data.review;
  } catch {
    return false;
  }
}

/** True when customer already rated or explicitly finished/skipped the completion screen */
export async function shouldSkipCompletionScreen(jobId: string): Promise<boolean> {
  if (await isJobCompletionDismissed(jobId)) return true;
  return jobHasReview(jobId);
}