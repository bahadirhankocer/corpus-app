import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './db';
import { DEFAULT_SETTINGS, type Settings } from './types';

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('app');
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  // Fields added by later versions are filled in from the defaults.
  const patch: Partial<Settings> = {};
  if (!existing.prompts) patch.prompts = DEFAULT_SETTINGS.prompts;
  if (!existing.notify) patch.notify = DEFAULT_SETTINGS.notify;
  if (Object.keys(patch).length > 0) {
    await db.settings.update('app', patch);
    return { ...existing, ...patch };
  }
  return existing;
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app'), []);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update('app', patch);
}
