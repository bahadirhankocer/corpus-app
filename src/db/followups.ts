import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Bi, FollowUp, LocalText, QuestionText } from './types';

export async function createFollowUp(entryId: string, text: Bi<QuestionText>): Promise<void> {
  const followUp: FollowUp = {
    id: uuid(),
    entryId,
    question: text.tr.question,
    options: text.tr.options,
    i18n: text,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await db.followups.add(followUp);
}

/**
 * The answer becomes part of the entry that was asked about, as a question-and-answer thread.
 * `answer` is an option index or the user's own words.
 */
export async function answerFollowUp(followUpId: string, answer: number | string): Promise<void> {
  const followUp = await db.followups.get(followUpId);
  if (!followUp) return;
  const entry = await db.entries.get(followUp.entryId);
  if (!entry) return;

  const question: LocalText = followUp.i18n
    ? { tr: followUp.i18n.tr.question, en: followUp.i18n.en.question }
    : followUp.question;
  const answerText: LocalText =
    typeof answer === 'string'
      ? answer
      : followUp.i18n
        ? { tr: followUp.i18n.tr.options[answer], en: followUp.i18n.en.options[answer] }
        : followUp.options[answer];

  const now = new Date().toISOString();
  await db.transaction('rw', db.entries, db.followups, async () => {
    await db.entries.update(entry.id, {
      thread: [...(entry.thread ?? []), { question, answer: answerText, at: now }],
      updatedAt: now,
      'ai.enriched': false,
      'sync.dirty': true,
    });
    await db.followups.update(followUpId, { status: 'answered' });
  });
}

export async function dismissFollowUp(followUpId: string): Promise<void> {
  await db.followups.update(followUpId, { status: 'dismissed' });
}
