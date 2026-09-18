import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Thought, ThoughtKind } from './types';

export interface NewThought {
  kind: ThoughtKind;
  text: string;
  entryIds: string[];
  projectId?: string;
}

export async function addThoughts(items: NewThought[]): Promise<void> {
  if (items.length === 0) return;
  const createdAt = new Date().toISOString();
  await db.thoughts.bulkAdd(items.map((item) => ({ id: uuid(), createdAt, ...item }) satisfies Thought));
}

export function useThoughts(limit: number, projectId?: string): Thought[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.thoughts.orderBy('createdAt').reverse().toArray();
    return (projectId ? all.filter((t) => t.projectId === projectId) : all).slice(0, limit);
  }, [limit, projectId]);
}
