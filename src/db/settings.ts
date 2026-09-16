import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './db';
import { DEFAULT_SETTINGS, type Settings } from './types';

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('app');
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app'), []);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update('app', patch);
}
