/**
 * System Sound Effects
 *
 * Plays pleasant, catchy UX sounds for key app events.
 * Combines expo-audio playback with expo-haptics for tactile feedback.
 *
 * Sound files: src/assets/sounds/ (Mixkit free SFX)
 *
 * Usage:
 *   import { playSystemSound } from '@/lib/sounds/system-sounds';
 *   playSystemSound('success');
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type SystemSoundKey =
  | 'tap'           // very short pop — tab switch / minor button
  | 'click'         // short pop — button press
  | 'success'       // pleasant chime — sign-in / submit success
  | 'notification'  // friendly ding — incoming message / state change
  | 'error'         // warning beep — failure
  | 'swoosh'        // whoosh — sending / page transition
  | 'complete'      // celebratory chime — job finished
  | 'new_job';      // attention ding — new request for technician

const SOUND_SOURCES: Record<SystemSoundKey, number> = {
  tap: require('@/assets/sounds/tap.mp3'),
  click: require('@/assets/sounds/click.mp3'),
  success: require('@/assets/sounds/success.mp3'),
  notification: require('@/assets/sounds/notification.mp3'),
  error: require('@/assets/sounds/error.mp3'),
  swoosh: require('@/assets/sounds/swoosh.mp3'),
  complete: require('@/assets/sounds/complete.mp3'),
  new_job: require('@/assets/sounds/new_job.mp3'),
};

const HAPTIC_MAP: Record<SystemSoundKey, () => void> = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  click: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  notification: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  swoosh: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  complete: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  new_job: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

const VOLUME_MAP: Record<SystemSoundKey, number> = {
  tap: 0.4,
  click: 0.5,
  success: 0.7,
  notification: 0.7,
  error: 0.6,
  swoosh: 0.5,
  complete: 0.8,
  new_job: 0.9,
};

let audioModeReady = false;
let soundsEnabled = true;
const playerCache: Partial<Record<SystemSoundKey, AudioPlayer>> = {};

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldRouteThroughEarpiece: false,
    });
    audioModeReady = true;
  } catch {
    audioModeReady = true;
  }
}

function getOrCreatePlayer(key: SystemSoundKey): AudioPlayer | null {
  try {
    if (!playerCache[key]) {
      playerCache[key] = createAudioPlayer(SOUND_SOURCES[key]);
    }
    return playerCache[key] ?? null;
  } catch (err) {
    
    return null;
  }
}

/**
 * Enable / disable all system sounds globally (haptics still fire).
 */
export function setSystemSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}

export function areSystemSoundsEnabled(): boolean {
  return soundsEnabled;
}

/**
 * Play a system sound + matching haptic.
 * Fail-safe: silently no-ops if audio cannot be played.
 */
export function playSystemSound(key: SystemSoundKey): void {
  HAPTIC_MAP[key]?.();

  if (!soundsEnabled) return;
  if (Platform.OS === 'web') return;

  ensureAudioMode();

  const player = getOrCreatePlayer(key);
  if (!player) return;

  try {
    player.volume = VOLUME_MAP[key];
    player.seekTo(0);
    player.play();
  } catch (err) {
    
  }
}

/**
 * Pre-warm players for the most-used sounds so the first play has zero latency.
 * Call once on app startup.
 */
export function preloadSystemSounds(): void {
  if (Platform.OS === 'web') return;
  ensureAudioMode();
  (Object.keys(SOUND_SOURCES) as SystemSoundKey[]).forEach((key) => {
    getOrCreatePlayer(key);
  });
}
