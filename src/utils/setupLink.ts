import { ensureSettings, updateSettings } from '../db/settings';

export interface SetupResult {
  keySaved: boolean;
  workerSaved: boolean;
}

/**
 * One-time setup link: `https://<app>/#k=<gemini key>&w=<push worker url>`.
 * The hash never leaves the device (browsers do not send it to servers) and is wiped from the
 * address bar as soon as it has been stored in IndexedDB.
 */
export async function consumeSetupLink(): Promise<SetupResult | null> {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const key = params.get('k')?.trim();
  const worker = params.get('w')?.trim();
  if (!key && !worker) return null;

  await ensureSettings();
  const patch: Parameters<typeof updateSettings>[0] = {};
  if (key) {
    patch.geminiApiKey = key;
    patch.aiEnabled = true;
  }
  if (worker) patch.pushWorkerUrl = worker.replace(/\/+$/, '');
  await updateSettings(patch);

  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return { keySaved: Boolean(key), workerSaved: Boolean(worker) };
}

export function buildSetupLink(key: string, workerUrl?: string): string {
  const params = new URLSearchParams({ k: key });
  if (workerUrl) params.set('w', workerUrl);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function maskKey(key: string): string {
  return key.length <= 8 ? '••••' : `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}
