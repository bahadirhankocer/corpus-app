import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './db';
import { answerFollowUp, dismissFollowUp } from './followups';
import { answerPrompt, skipPrompt } from './prompts';

/** One question waiting for the user: either a follow-up on an entry or a proactive prompt. */
export interface Question {
  key: string;
  source: 'followup' | 'prompt';
  id: string;
  kicker: string;
  origin: string;
  question: string;
  options: string[];
  createdAt: string;
}

export function useQuestions(): Question[] | undefined {
  return useLiveQuery(async () => {
    const prompts = await db.prompts.where('status').equals('pending').toArray();
    const followUps = await db.followups.where('status').equals('pending').toArray();
    const items: Question[] = prompts.map((p) => ({
      key: `p-${p.id}`,
      source: 'prompt',
      id: p.id,
      kicker: p.kind,
      origin: p.context,
      question: p.question,
      options: p.options,
      createdAt: p.createdAt,
    }));
    for (const f of followUps) {
      const entry = await db.entries.get(f.entryId);
      items.push({
        key: `f-${f.id}`,
        source: 'followup',
        id: f.id,
        kicker: 'followup',
        origin: entry?.title || entry?.text || entry?.transcript || '',
        question: f.question,
        options: f.options,
        createdAt: f.createdAt,
      });
    }
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, []);
}

export async function answerQuestion(q: Question, optionIndex: number | null, freeText?: string): Promise<void> {
  if (q.source === 'followup') {
    await answerFollowUp(q.id, optionIndex ?? freeText ?? '');
    return;
  }
  await answerPrompt(q.id, optionIndex !== null ? q.options[optionIndex] : (freeText ?? ''));
}

export async function dismissQuestion(q: Question): Promise<void> {
  if (q.source === 'followup') await dismissFollowUp(q.id);
  else await skipPrompt(q.id);
}
