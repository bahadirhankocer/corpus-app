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
  if (!existing.prompts) {
    existing.prompts = DEFAULT_SETTINGS.prompts;
    await db.settings.update('app', { prompts: existing.prompts });
  }
  return existing;
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app'), []);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update('app', patch);
}
