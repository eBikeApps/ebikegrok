import type { Router } from 'expo-router';
import { clearCustomerActiveJobState, resolveJobTrackingEntry } from '@/lib/active-job-sync';

type PushPayload = {
  jobId?: string;
  screen?: string;
  invitationId?: string;
};

function normalizeScreen(screen?: string): string {
  return (screen ?? '').trim().replace(/^\/+/, '');
}

async function openJobTracking(router: Router, jobId: string) {
  const resolution = await resolveJobTrackingEntry(jobId);
  if (resolution.action === 'home') {
    clearCustomerActiveJobState();
    router.replace('/(customer)/(tabs)');
    return;
  }
  if (resolution.action === 'complete') {
    clearCustomerActiveJobState();
    router.replace({ pathname: '/job-complete', params: { id: resolution.jobId } });
    return;
  }
  router.push({ pathname: '/job-tracking', params: { id: jobId } });
}

export async function handlePushNotificationNavigation(router: Router, raw: PushPayload) {
  const screen = normalizeScreen(raw.screen);
  const jobId = raw.jobId;

  if (screen === 'job-tracking' && jobId) {
    await openJobTracking(router, jobId);
    return;
  }

  if ((screen === 'active-job' || screen === '(technician)/active-job') && jobId) {
    router.push({ pathname: '/(technician)/active-job', params: { id: jobId } });
    return;
  }

  if (screen === '(technician)/(tabs)') {
    router.replace('/(technician)/(tabs)');
    return;
  }

  if (screen === '(technician)/invitations') {
    router.push('/(technician)/invitations');
    return;
  }

  if (screen === '/(customer)/(tabs)') {
    router.replace('/(customer)/(tabs)');
    return;
  }

  // Legacy extra-payment pushes — open job tracking instead
  if (screen === 'extra-payment' && jobId) {
    await openJobTracking(router, jobId);
  }
}