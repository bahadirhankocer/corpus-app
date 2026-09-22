import { refreshCorpus } from './corpusJob';
import { ideatePrompt } from './ideate';
import { writeListenNotes } from './notes';
import { kickAiQueue, kickEnrichment } from './queue';
import { addNotes, latestCorpus, recentListenBodies, unusedListenNotes } from '../db/corpus';
import { db } from '../db/db';
import { createPrompt, expireOldPrompts, promptStats } from '../db/prompts';
import { ensureSettings, updateSettings } from '../db/settings';
import type { Prompt, PromptKind } from '../db/types';

const MIN_GAP_MS = 3 * 60 * 60 * 1000;
const MAX_PENDING = 2;
const RECENT_LIMIT = 15;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const NOTES_LOW_WATER = 3;
const NOTES_MIN_GAP_MS = 12 * 60 * 60 * 1000;

const KIND_WEIGHTS: [PromptKind, number][] = [
  ['deepen', 35],
  ['imagine', 30],
  ['pattern', 20],
  ['sequence', 15],
];

function pickKind(): PromptKind {
  const total = KIND_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [kind, weight] of KIND_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return 'deepen';
}

function inActiveWindow(startHour: number, endHour: number): boolean {
  const hour = new Date().getHours();
  return hour >= startHour && hour < endHour;
}

let creating = false;

/**
 * Brings one new question to the user when the day allows it. `force` is used when the user
 * arrived through a push notification: the window and spacing rules are skipped once.
 */
export async function maybeCreatePrompt(options: { force?: boolean } = {}): Promise<Prompt | null> {
  if (creating) return null;
  creating = true;
  try {
    const settings = await ensureSettings();
    if (!settings.aiEnabled || !settings.geminiApiKey || !navigator.onLine) return null;

    await expireOldPrompts();
    const stats = await promptStats();
    if (stats.pending >= MAX_PENDING) return null;

    const { perDay, startHour, endHour } = settings.prompts;
    if (!options.force) {
      if (!inActiveWindow(startHour, endHour)) return null;
      if (stats.today >= perDay) return null;
      if (stats.lastCreatedAt && Date.now() - new Date(stats.lastCreatedAt).getTime() < MIN_GAP_MS) return null;
    } else if (stats.today >= perDay + 1) {
      return null;
    }

    const done = await db.entries.where('ai.status').equals('done').reverse().sortBy('createdAt');
    if (done.length === 0) return null;

    const previous = (await db.prompts.orderBy('createdAt').reverse().limit(8).toArray()).map((p) => p.question);
    const kind = pickKind();
    const text = await ideatePrompt({
      kind,
      project: undefined,
      corpus: await latestCorpus(),
      recent: done.slice(0, RECENT_LIMIT),
      previousQuestions: previous,
      styleGuide: settings.styleGuide,
      apiKey: settings.geminiApiKey,
      model: settings.model,
    });
    if (!text.tr?.question?.trim() || text.tr.options?.length !== 3 || text.en?.options?.length !== 3) return null;

    const prompt = await createPrompt({ kind, text });
    await updateSettings({ prompts: { ...settings.prompts, lastCreatedAt: prompt.createdAt } });
    return prompt;
  } catch {
    return null;
  } finally {
    creating = false;
  }
}

/** Keeps a small pool of "I listened" notifications ready for the service worker. */
async function maybeRefillNotes(): Promise<void> {
  const settings = await ensureSettings();
  if (!settings.pushSubscribed || !settings.aiEnabled || !settings.geminiApiKey || !navigator.onLine) return;
  if ((await unusedListenNotes()).length >= NOTES_LOW_WATER) return;
  if (settings.lastNotesAt && Date.now() - new Date(settings.lastNotesAt).getTime() < NOTES_MIN_GAP_MS) return;

  const done = await db.entries.where('ai.status').equals('done').reverse().sortBy('createdAt');
  if (done.length === 0) return;
  await updateSettings({ lastNotesAt: new Date().toISOString() });
  try {
    const bodies = await writeListenNotes(done.slice(0, 25), await recentListenBodies(12), settings.geminiApiKey, settings.model);
    await addNotes(bodies.map((body) => ({ kind: 'listen' as const, body })));
  } catch {
    // tried again after the gap
  }
}

/** Keeps the AI working while the app is open: queue, enrichment, corpus, questions and notifications. */
export function startBackgroundLoops(): () => void {
  const tick = () => {
    void kickAiQueue();
    void kickEnrichment();
    void refreshCorpus();
    void maybeCreatePrompt();
    void maybeRefillNotes();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  const onOnline = () => tick();

  tick();
  const interval = window.setInterval(tick, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}
