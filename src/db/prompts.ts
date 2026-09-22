import { v4 as uuid } from 'uuid';

import { db } from './db';
import { createEntry, overrideProjectId } from './entries';
import type { Bi, Prompt, QuestionText } from './types';

export interface NewPrompt {
  kind: Prompt['kind'];
  projectId?: string;
  text: Bi<QuestionText>;
}

const EXPIRE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export async function createPrompt(input: NewPrompt): Promise<Prompt> {
  const prompt: Prompt = {
    id: uuid(),
    kind: input.kind,
    projectId: input.projectId,
    context: input.text.tr.context ?? '',
    question: input.text.tr.question,
    options: input.text.tr.options,
    i18n: input.text,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
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

/** An answer to the AI's own question is a new thought, so it becomes an entry with the question beside it. */
export async function answerPrompt(id: string, answer: number | string): Promise<void> {
  const prompt = await db.prompts.get(id);
  if (!prompt) return;
  const text =
    typeof answer === 'string' ? answer : (prompt.i18n?.tr.options[answer] ?? prompt.options[answer]);
  const entry = await createEntry({ kind: 'text', text, importance: 2 });
  await db.entries.update(entry.id, {
    promptQuestion: prompt.i18n ? { tr: prompt.i18n.tr.question, en: prompt.i18n.en.question } : prompt.question,
  });
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
