import { DEFAULT_PUSH_WORKER_URL } from '../../config';
import { ensureSettings, updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';

export type EnableResult = 'ok' | 'denied' | 'no-worker' | 'unsupported' | 'error';

export function pushSupported(): boolean {
  return (
    !import.meta.env.DEV &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
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

async function register(workerUrl: string, subscription: PushSubscription, settings: Settings): Promise<void> {
  const res = await fetch(`${workerUrl}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      tzOffsetMin: -new Date().getTimezoneOffset(),
      startHour: settings.prompts.startHour,
      endHour: settings.prompts.endHour,
      perDay: settings.prompts.perDay,
      lang: settings.lang,
    }),
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
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }));
    await register(workerUrl, subscription, settings);
    await updateSettings({ pushSubscribed: true });
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  const settings = await ensureSettings();
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const workerUrl = workerUrlFor(settings);
    if (subscription && workerUrl) {
      await fetch(`${workerUrl}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
    }
    await subscription?.unsubscribe();
  } finally {
    await updateSettings({ pushSubscribed: false });
  }
}

/** Re-sends the schedule to the Worker after the hours or frequency change. */
export async function syncPush(): Promise<void> {
  if (!pushSupported()) return;
  const settings = await ensureSettings();
  const workerUrl = workerUrlFor(settings);
  if (!settings.pushSubscribed || !workerUrl) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await register(workerUrl, subscription, settings);
  } catch {
    // the next change or app start retries
  }
}
