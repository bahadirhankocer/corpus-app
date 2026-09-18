import { ideatePrompt } from './ideate';
import { kickAiQueue, kickEnrichment } from './queue';
import { db } from '../db/db';
import { effectiveProjectId } from '../db/effective';
import { createPrompt, expireOldPrompts, promptStats } from '../db/prompts';
import { ensureSettings, updateSettings } from '../db/settings';
import type { Entry, Prompt, PromptKind } from '../db/types';

const MIN_GAP_MS = 3 * 60 * 60 * 1000;
const MAX_PENDING = 2;
const RECENT_LIMIT = 15;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

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

/** Projects with more recent activity are asked about more often. */
function pickProjectId(entries: Entry[], projectIds: string[]): string | undefined {
  if (projectIds.length === 0) return undefined;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weights = projectIds.map((id) => 1 + entries.filter((e) => effectiveProjectId(e) === id && new Date(e.createdAt).getTime() > weekAgo).length);
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < projectIds.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return projectIds[i];
  }
  return projectIds[0];
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

    const activeProjects = await db.projects.where('status').equals('active').toArray();
    const projectIds = activeProjects.filter((p) => done.some((e) => effectiveProjectId(e) === p.id)).map((p) => p.id);
    const projectId = pickProjectId(done, projectIds);
    const project = activeProjects.find((p) => p.id === projectId);
    const pool = projectId ? done.filter((e) => effectiveProjectId(e) === projectId) : done;

    const previous = (await db.prompts.orderBy('createdAt').reverse().limit(8).toArray()).map((p) => p.question);
    const kind = pickKind();
    const result = await ideatePrompt({
      kind,
      project,
      recent: pool.slice(0, RECENT_LIMIT),
      previousQuestions: previous,
      styleGuide: settings.styleGuide,
      apiKey: settings.geminiApiKey,
      model: settings.model,
    });
    if (!result.question?.trim() || result.options?.length !== 3) return null;

    const prompt = await createPrompt({
      kind,
      projectId,
      context: result.context?.trim() ?? '',
      question: result.question.trim(),
      options: result.options,
    });
    await updateSettings({ prompts: { ...settings.prompts, lastCreatedAt: prompt.createdAt } });
    return prompt;
  } catch {
    return null;
  } finally {
    creating = false;
  }
}

/** Keeps the AI working while the app is open: queue, enrichment and the day's questions. */
export function startBackgroundLoops(): () => void {
  const tick = () => {
    void kickAiQueue();
    void kickEnrichment();
    void maybeCreatePrompt();
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
