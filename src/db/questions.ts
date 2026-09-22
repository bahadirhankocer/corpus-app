import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './db';
import { answerFollowUp, dismissFollowUp } from './followups';
import { answerPrompt, skipPrompt } from './prompts';
import type { Lang } from './types';
import { entryHeadline, locQuestion } from '../i18n/localize';

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

export function useQuestions(lang: Lang): Question[] | undefined {
  return useLiveQuery(async () => {
    const prompts = await db.prompts.where('status').equals('pending').toArray();
    const followUps = await db.followups.where('status').equals('pending').toArray();
    const items: Question[] = prompts.map((p) => {
      const text = locQuestion(p, lang);
      return {
        key: `p-${p.id}`,
        source: 'prompt',
        id: p.id,
        kicker: p.kind,
        origin: text.context ?? '',
        question: text.question,
        options: text.options,
        createdAt: p.createdAt,
      };
    });
    for (const f of followUps) {
      const entry = await db.entries.get(f.entryId);
      if (!entry) continue;
      const text = locQuestion(f, lang);
      items.push({
        key: `f-${f.id}`,
        source: 'followup',
        id: f.id,
        kicker: 'followup',
        origin: entryHeadline(entry, lang),
        question: text.question,
        options: text.options,
        createdAt: f.createdAt,
      });
    }
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [lang]);
}

export async function answerQuestion(q: Question, optionIndex: number | null, freeText?: string): Promise<void> {
  const answer = optionIndex ?? freeText ?? '';
  if (q.source === 'followup') await answerFollowUp(q.id, answer);
  else await answerPrompt(q.id, answer);
}

export async function dismissQuestion(q: Question): Promise<void> {
  if (q.source === 'followup') await dismissFollowUp(q.id);
  else await skipPrompt(q.id);
}

export async function pendingQuestionCount(): Promise<number> {
  return (await db.prompts.where('status').equals('pending').count()) + (await db.followups.where('status').equals('pending').count());
}
