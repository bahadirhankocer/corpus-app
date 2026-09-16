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
  parentEntryId?: string;
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
    parentEntryId: input.parentEntryId,
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

export function useChildren(entryId: string | undefined): Entry[] | undefined {
  return useLiveQuery(
    () => (entryId ? db.entries.where('parentEntryId').equals(entryId).toArray() : []),
    [entryId],
  );
}

export async function markSurfaced(id: string): Promise<void> {
  await db.entries.update(id, { lastSurfacedAt: new Date().toISOString() });
}

const RESURFACE_MIN_AGE_DAYS = 3;

export async function pickResurfaceCandidate(): Promise<Entry | undefined> {
  const cutoff = Date.now() - RESURFACE_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
  const candidates = await db.entries
    .filter((e) => new Date(e.createdAt).getTime() < cutoff)
    .toArray();
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    const aSurfaced = a.lastSurfacedAt ? new Date(a.lastSurfacedAt).getTime() : 0;
    const bSurfaced = b.lastSurfacedAt ? new Date(b.lastSurfacedAt).getTime() : 0;
    return aSurfaced - bSurfaced;
  });
  const pool = candidates.slice(0, Math.max(5, Math.ceil(candidates.length / 3)));
  return pool[Math.floor(Math.random() * pool.length)];
}
