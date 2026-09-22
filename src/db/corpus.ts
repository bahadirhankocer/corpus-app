import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { CorpusDoc, Dossier, Note, Sketch } from './types';

const KEEP_VERSIONS = 40;

export async function latestCorpus(): Promise<CorpusDoc | undefined> {
  return db.corpora.orderBy('createdAt').last();
}

export async function saveCorpus(doc: Omit<CorpusDoc, 'id' | 'createdAt'>): Promise<CorpusDoc> {
  const saved: CorpusDoc = { ...doc, id: uuid(), createdAt: new Date().toISOString() };
  await db.corpora.add(saved);
  const keys = await db.corpora.orderBy('createdAt').primaryKeys();
  if (keys.length > KEEP_VERSIONS) await db.corpora.bulkDelete(keys.slice(0, keys.length - KEEP_VERSIONS));
  return saved;
}

/** Newest first. */
export function useCorpusVersions(): CorpusDoc[] | undefined {
  return useLiveQuery(() => db.corpora.orderBy('createdAt').reverse().toArray(), []);
}

export async function latestDossier(): Promise<Dossier | undefined> {
  return db.dossiers.orderBy('createdAt').last();
}

export async function saveDossier(doc: Omit<Dossier, 'id' | 'createdAt'>): Promise<void> {
  await db.dossiers.clear();
  await db.dossiers.add({ ...doc, id: uuid(), createdAt: new Date().toISOString() });
}

export function useDossier(): Dossier | undefined {
  return useLiveQuery(() => db.dossiers.orderBy('createdAt').last(), []);
}

/** undefined while loading, null when no sketch was written yet. */
export function useSketch(key: string): Sketch | null | undefined {
  return useLiveQuery(async () => (await db.sketches.get(key)) ?? null, [key]);
}

export async function saveSketch(key: string, html: string): Promise<void> {
  await db.sketches.put({ key, html, createdAt: new Date().toISOString() });
}

export async function addNotes(notes: Omit<Note, 'id' | 'createdAt'>[]): Promise<void> {
  const createdAt = new Date().toISOString();
  await db.notes.bulkAdd(notes.map((n) => ({ ...n, id: uuid(), createdAt })));
}

/** The morning note is a single record that every new corpus version overwrites. */
export async function setMorningNote(body: Note['body']): Promise<void> {
  await db.notes.put({ id: 'morning', kind: 'morning', body, createdAt: new Date().toISOString() });
}

export async function unusedListenNotes(): Promise<Note[]> {
  return db.notes.where('kind').equals('listen').filter((n) => !n.usedAt).toArray();
}

export async function recentListenBodies(limit: number): Promise<string[]> {
  const all = await db.notes.where('kind').equals('listen').toArray();
  return all
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((n) => n.body.tr);
}
