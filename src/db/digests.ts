import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Digest } from './types';

export async function createDigest(
  kind: Digest['kind'],
  periodStart: string,
  body: string,
  entryIds: string[],
): Promise<void> {
  const digest: Digest = {
    id: uuid(),
    kind,
    periodStart,
    body,
    entryIds,
    createdAt: new Date().toISOString(),
  };
  await db.digests.add(digest);
}

export function useDigests(): Digest[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.digests.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);
}
