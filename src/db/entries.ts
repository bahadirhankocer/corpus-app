import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Category, Entry } from './types';

export interface NewEntryInput {
  kind: Entry['kind'];
  text?: string;
  audioId?: string;
  title?: string;
  importance: Entry['importance'];
  context?: string;
}

export async function createEntry(input: NewEntryInput): Promise<Entry> {
  const now = new Date().toISOString();
  const entry: Entry = {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    kind: input.kind,
    text: input.text,
    audioId: input.audioId,
    title: input.title,
    importance: input.importance,
    context: input.context,
    ai: { status: 'pending', categories: [], tags: [] },
    overrides: {},
    sync: { dirty: true },
  };
  await db.entries.add(entry);
  return entry;
}

export async function updateEntry(
  id: string,
  patch: Partial<Pick<Entry, 'text' | 'title' | 'importance' | 'context'>>,
): Promise<void> {
  await db.entries.update(id, { ...patch, updatedAt: new Date().toISOString(), 'sync.dirty': true });
}

export async function overrideCategories(id: string, categories: Category[]): Promise<void> {
  await db.entries.update(id, { 'overrides.categories': categories, updatedAt: new Date().toISOString(), 'sync.dirty': true });
}

export async function overrideProjectId(id: string, projectId: string | undefined): Promise<void> {
  await db.entries.update(id, { 'overrides.projectId': projectId, updatedAt: new Date().toISOString(), 'sync.dirty': true });
}

export async function overrideTags(id: string, tags: string[]): Promise<void> {
  await db.entries.update(id, { 'overrides.tags': tags, updatedAt: new Date().toISOString(), 'sync.dirty': true });
}

export async function deleteEntry(id: string): Promise<void> {
  const entry = await db.entries.get(id);
  await db.entries.delete(id);
  if (entry?.audioId) {
    await db.audioBlobs.delete(entry.audioId);
  }
}

export function useEntries(): Entry[] | undefined {
  return useLiveQuery(() => db.entries.orderBy('createdAt').reverse().toArray(), []);
}

export function useEntry(id: string | undefined): Entry | undefined {
  return useLiveQuery(() => (id ? db.entries.get(id) : undefined), [id]);
}

export function usePendingCount(): number | undefined {
  return useLiveQuery(() => db.entries.where('ai.status').equals('pending').count(), []);
}
