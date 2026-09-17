import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Link } from './types';

export async function createSuggestedLink(
  fromId: string,
  toId: string,
  kind: Link['kind'],
  rationale: string,
): Promise<void> {
  const existing = await db.links
    .where('fromId')
    .equals(fromId)
    .filter((l) => l.toId === toId)
    .first();
  if (existing) return;

  const link: Link = {
    id: uuid(),
    fromId,
    toId,
    kind,
    rationale,
    state: 'suggested',
    createdAt: new Date().toISOString(),
  };
  await db.links.add(link);
}

export async function setLinkState(id: string, state: Link['state']): Promise<void> {
  await db.links.update(id, { state });
}

export function useLinksForEntries(entryIds: string[]): Link[] | undefined {
  return useLiveQuery(async () => {
    if (entryIds.length === 0) return [];
    const idSet = new Set(entryIds);
    const all = await db.links.toArray();
    return all.filter((l) => idSet.has(l.fromId) && idSet.has(l.toId) && l.state !== 'dismissed');
  }, [entryIds.join(',')]);
}
