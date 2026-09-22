import { db } from './db';
import { ensureSettings, updateSettings } from './settings';
import type { ThreadItem } from './types';

const CURRENT = 1;

/**
 * 1: answers to follow-up questions used to be separate entries. They become a question-and-answer
 * thread inside the entry that was asked about, so the feed holds only what was actually written.
 */
async function mergeAnswersIntoThreads(): Promise<void> {
  const answered = (await db.followups.where('status').equals('answered').toArray()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const answerOf = new Map(answered.filter((f) => f.answerEntryId).map((f) => [f.answerEntryId!, f]));

  const rootOf = (entryId: string): string => {
    let id = entryId;
    for (let guard = 0; guard < 20; guard++) {
      const asked = answerOf.get(id);
      if (!asked) return id;
      id = asked.entryId;
    }
    return id;
  };

  await db.transaction('rw', [db.entries, db.followups, db.links, db.prompts], async () => {
    const threads = new Map<string, ThreadItem[]>();
    for (const f of answered) {
      const answer = f.answerEntryId ? await db.entries.get(f.answerEntryId) : undefined;
      if (!answer) continue;
      const root = rootOf(f.entryId);
      const list = threads.get(root) ?? [];
      list.push({ question: f.question, answer: answer.text ?? answer.transcript ?? '', at: answer.createdAt });
      threads.set(root, list);
    }

    for (const [rootId, items] of threads) {
      const root = await db.entries.get(rootId);
      if (!root) continue;
      await db.entries.update(rootId, { thread: [...(root.thread ?? []), ...items], 'ai.enriched': false });
    }

    const answerIds = [...answerOf.keys()];
    for (const f of await db.followups.toArray()) {
      if (answerOf.has(f.entryId)) await db.followups.update(f.id, { entryId: rootOf(f.entryId) });
    }
    if (answerIds.length > 0) {
      await db.links.where('fromId').anyOf(answerIds).delete();
      await db.links.where('toId').anyOf(answerIds).delete();
      await db.entries.bulkDelete(answerIds);
    }

    // Answers to the AI's own questions stay entries, with the question kept beside them.
    for (const p of await db.prompts.where('status').equals('answered').toArray()) {
      if (!p.answerEntryId) continue;
      const entry = await db.entries.get(p.answerEntryId);
      if (!entry) continue;
      await db.entries.update(entry.id, {
        promptQuestion: p.question,
        context: entry.context === p.question ? undefined : entry.context,
      });
    }
  });
}

export async function runDataMigrations(): Promise<void> {
  const settings = await ensureSettings();
  const from = settings.dataVersion ?? 0;
  if (from >= CURRENT) return;
  if (from < 1) await mergeAnswersIntoThreads();
  await updateSettings({ dataVersion: CURRENT });
}
