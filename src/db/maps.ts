import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { SequenceMap } from './types';

const KEEP_MAPS = 5;

export async function latestMap(): Promise<SequenceMap | undefined> {
  return db.maps.orderBy('createdAt').last();
}

export async function saveMap(map: Omit<SequenceMap, 'id' | 'createdAt'>): Promise<void> {
  await db.maps.add({ ...map, id: uuid(), createdAt: new Date().toISOString() });
  const keys = await db.maps.orderBy('createdAt').primaryKeys();
  if (keys.length > KEEP_MAPS) await db.maps.bulkDelete(keys.slice(0, keys.length - KEEP_MAPS));
}

/** undefined while loading, null before the first map is drawn. */
export function useLatestMap(): SequenceMap | null | undefined {
  return useLiveQuery(async () => (await db.maps.orderBy('createdAt').last()) ?? null, []);
}
