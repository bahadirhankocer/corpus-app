import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import { createEntry } from './entries';
import type { FollowUp } from './types';

export async function createFollowUp(entryId: string, question: string, options: string[]): Promise<void> {
  const followUp: FollowUp = {
    id: uuid(),
    entryId,
    question,
    options,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await db.followups.add(followUp);
}

export async function hasPendingFollowUp(entryId: string): Promise<boolean> {
  const existing = await db.followups.where('entryId').equals(entryId).first();
  return existing !== undefined;
}

export interface PendingFollowUp extends FollowUp {
  entryPreview: string;
}

export function usePendingFollowUp(): PendingFollowUp | undefined {
  return useLiveQuery(async () => {
    const pending = await db.followups.where('status').equals('pending').first();
    if (!pending) return undefined;
    const entry = await db.entries.get(pending.entryId);
    const entryPreview = entry?.title || entry?.text || entry?.transcript || '';
    return { ...pending, entryPreview };
  }, []);
}

export async function answerFollowUp(followUpId: string, optionIndex: number): Promise<void> {
  const followUp = await db.followups.get(followUpId);
  if (!followUp) return;
  const parentEntry = await db.entries.get(followUp.entryId);
  const answer = await createEntry({
    kind: 'text',
    text: followUp.options[optionIndex],
    importance: parentEntry?.importance ?? 2,
    parentEntryId: followUp.entryId,
  });
  await db.followups.update(followUpId, { status: 'answered', answerEntryId: answer.id });
}

export async function dismissFollowUp(followUpId: string): Promise<void> {
  await db.followups.update(followUpId, { status: 'dismissed' });
}
