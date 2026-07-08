import { JobStatus } from '@/lib/types';

export const statusSteps: {
  key: JobStatus;
  labelKey: string;
  icon: string;
  timestampField: 'accepted_at' | 'on_way_at' | 'arrived_at' | 'in_progress_at';
}[] = [
  { key: 'accepted', labelKey: 'technicianSetOff', icon: '🚀', timestampField: 'accepted_at' },
  { key: 'on_way', labelKey: 'technicianAlmostHere', icon: '🚗', timestampField: 'on_way_at' },
  { key: 'arrived', labelKey: 'technicianArrived', icon: '📍', timestampField: 'arrived_at' },
  { key: 'in_progress', labelKey: 'repairInProgress', icon: '🔧', timestampField: 'in_progress_at' },
];

export function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcEta(distanceKm: number): number {
  return Math.max(1, Math.ceil((distanceKm / 25) * 60) + 5);
}

export function formatTime(isoString?: string): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}