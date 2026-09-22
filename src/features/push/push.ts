import { DEFAULT_PUSH_WORKER_URL } from '../../config';
import { ensureSettings, updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';

export type EnableResult = 'ok' | 'denied' | 'no-worker' | 'unsupported' | 'error';

export function pushSupported(): boolean {
  return !import.meta.env.DEV && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function workerUrlFor(settings: Settings): string {
  return (settings.pushWorkerUrl || DEFAULT_PUSH_WORKER_URL).replace(/\/+$/, '');
}

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function post(path: string, body: unknown): Promise<Response> {
  const settings = await ensureSettings();
  const workerUrl = workerUrlFor(settings);
  if (!workerUrl) throw new Error('no worker');
  return fetch(`${workerUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * The Worker only learns when to wake the phone. What the notification says is decided on the phone,
 * from notes stored in IndexedDB, so no entry ever leaves the device.
 */
async function register(subscription: PushSubscription, settings: Settings): Promise<void> {
  const res = await post('/subscribe', {
    subscription: subscription.toJSON(),
    tzOffsetMin: -new Date().getTimezoneOffset(),
    startHour: settings.prompts.startHour,
    endHour: settings.prompts.endHour,
    slots: settings.notify.listen + settings.notify.questions,
    morning: settings.notify.morning,
  });
  if (!res.ok) throw new Error(`worker ${res.status}`);
}

export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return 'unsupported';
  const settings = await ensureSettings();
  const workerUrl = workerUrlFor(settings);
  if (!workerUrl) return 'no-worker';

  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const publicKey = (await (await fetch(`${workerUrl}/vapid`)).text()).trim();
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }));
    await register(subscription, settings);
    await updateSettings({ pushSubscribed: true });
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  try {
    const subscription = await currentSubscription();
    if (subscription) {
      await post('/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
      await subscription.unsubscribe();
    }
  } finally {
    await updateSettings({ pushSubscribed: false });
  }
}

/** Re-sends the schedule to the Worker after the hours or counts change. */
export async function syncPush(): Promise<void> {
  if (!pushSupported()) return;
  const settings = await ensureSettings();
  if (!settings.pushSubscribed || !workerUrlFor(settings)) return;
  try {
    const subscription = await currentSubscription();
    if (subscription) await register(subscription, settings);
  } catch {
    // the next change or app start retries
  }
}

/** Asks the Worker to wake the phone once at `at` (an echo of a new entry). */
export async function schedulePing(at: string): Promise<void> {
  if (!pushSupported()) return;
  const settings = await ensureSettings();
  if (!settings.pushSubscribed || !workerUrlFor(settings)) return;
  try {
    const subscription = await currentSubscription();
    if (subscription) await post('/ping', { endpoint: subscription.endpoint, at });
  } catch {
    // an echo is a nicety; the regular slots still arrive
  }
}

export async function sendTestPush(): Promise<boolean> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return false;
    const res = await post('/test', { endpoint: subscription.endpoint });
    return res.ok;
  } catch {
    return false;
  }
}
