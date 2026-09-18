import { v4 as uuid } from 'uuid';

import { db } from './db';
import { createEntry } from './entries';
import { overrideProjectId } from './entries';
import type { Prompt } from './types';

export type NewPrompt = Pick<Prompt, 'kind' | 'projectId' | 'context' | 'question' | 'options'>;

const EXPIRE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export async function createPrompt(input: NewPrompt): Promise<Prompt> {
  const prompt: Prompt = { id: uuid(), status: 'pending', createdAt: new Date().toISOString(), ...input };
  await db.prompts.add(prompt);
  return prompt;
}

/** Questions the user ignored fade away instead of piling up. */
export async function expireOldPrompts(): Promise<void> {
  const cutoff = Date.now() - EXPIRE_AFTER_MS;
  const stale = await db.prompts
    .where('status')
    .equals('pending')
    .filter((p) => new Date(p.createdAt).getTime() < cutoff)
    .primaryKeys();
  await db.prompts.bulkUpdate(stale.map((key) => ({ key, changes: { status: 'skipped' as const } })));
}

export async function answerPrompt(id: string, answer: string): Promise<void> {
  const prompt = await db.prompts.get(id);
  if (!prompt) return;
  const entry = await createEntry({ kind: 'text', text: answer, importance: 2, context: prompt.question });
  if (prompt.projectId) await overrideProjectId(entry.id, prompt.projectId);
  await db.prompts.update(id, { status: 'answered', answerEntryId: entry.id });
}

export async function skipPrompt(id: string): Promise<void> {
  await db.prompts.update(id, { status: 'skipped' });
}

export async function promptStats(): Promise<{ pending: number; today: number; lastCreatedAt?: string }> {
  const all = await db.prompts.toArray();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = all.filter((p) => new Date(p.createdAt) >= startOfDay).length;
  const last = all.map((p) => p.createdAt).sort().at(-1);
  return { pending: all.filter((p) => p.status === 'pending').length, today, lastCreatedAt: last };
}
