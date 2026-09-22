import { writeCorpus } from './corpus';
import { writeDossier } from './dossier';
import { aiJobDone, aiJobQueued, aiReportError } from './status';
import { addNotes, latestCorpus, latestDossier, saveCorpus, saveDossier, setMorningNote } from '../db/corpus';
import { db } from '../db/db';
import { ensureSettings } from '../db/settings';
import type { Entry } from '../db/types';
import { schedulePing } from '../features/push/push';

const DEBOUNCE_MS = 40_000;
const MIN_RETRY_MS = 90_000;
const DOSSIER_EVERY_ENTRIES = 4;
const DOSSIER_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const ECHO_MIN_MS = 60 * 60 * 1000;
const ECHO_MAX_MS = 3 * 60 * 60 * 1000;

let timer = 0;
let running = false;
let lastAttempt = 0;

function fnv(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function sourceSig(entries: Entry[]): string {
  return fnv(
    entries
      .map((e) => `${e.id}:${e.updatedAt}:${e.thread?.length ?? 0}`)
      .sort()
      .join('|'),
  );
}

/** An echo due at night waits for the morning instead of waking him. */
function withinWindow(date: Date, startHour: number, endHour: number): Date {
  const hour = date.getHours();
  if (hour >= startHour && hour < endHour) return date;
  const next = new Date(date);
  if (hour >= endHour) next.setDate(next.getDate() + 1);
  next.setHours(startHour, 20 + Math.floor(Math.random() * 60), 0, 0);
  return next;
}

/** Rewrites the corpus a little after the last change, so a burst of entries costs one rewrite. */
export function scheduleCorpus(delay = DEBOUNCE_MS): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void refreshCorpus(), delay);
}

export async function refreshCorpus(options: { force?: boolean } = {}): Promise<void> {
  if (running) return;
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey || !navigator.onLine) return;

  // Wait briefly for entries that are being classified right now, but never for long and never when forced.
  const recent = Date.now() - 3 * 60 * 1000;
  const busy = await db.entries
    .where('ai.status')
    .anyOf('pending', 'processing')
    .filter((e) => new Date(e.updatedAt).getTime() > recent)
    .count();
  if (busy > 0 && !options.force) {
    scheduleCorpus();
    return;
  }
  const done = await db.entries.where('ai.status').equals('done').toArray();
  if (done.length === 0) return;

  const sig = sourceSig(done);
  const previous = await latestCorpus();
  if (!options.force && previous?.sourceSig === sig) return;
  if (!options.force && Date.now() - lastAttempt < MIN_RETRY_MS) return;

  running = true;
  lastAttempt = Date.now();
  aiJobQueued();
  try {
    const projects = await db.projects.toArray();
    const since = previous?.createdAt ?? '';
    const newEntryIds = previous ? done.filter((e) => e.updatedAt > since).map((e) => e.id) : [];
    const draft = await writeCorpus({
      entries: done,
      projects,
      previous,
      newEntryIds,
      styleGuide: settings.styleGuide,
      apiKey: settings.geminiApiKey,
      model: settings.model,
    });
    const corpus = await saveCorpus({ ...draft, sourceSig: sig, entryCount: done.length });
    await setMorningNote(draft.morning);

    if (previous && newEntryIds.length > 0) {
      const dueAt = withinWindow(
        new Date(Date.now() + ECHO_MIN_MS + Math.random() * (ECHO_MAX_MS - ECHO_MIN_MS)),
        settings.prompts.startHour,
        settings.prompts.endHour,
      ).toISOString();
      await addNotes([{ kind: 'echo', body: draft.delta, dueAt }]);
      void schedulePing(dueAt);
    }

    const dossier = await latestDossier();
    const stale =
      !dossier ||
      done.length - dossier.entryCount >= DOSSIER_EVERY_ENTRIES ||
      (done.length !== dossier.entryCount && Date.now() - new Date(dossier.createdAt).getTime() > DOSSIER_MAX_AGE_MS);
    if (stale) {
      const next = await writeDossier({
        corpus,
        entries: done,
        projects,
        previous: dossier,
        styleGuide: settings.styleGuide,
        apiKey: settings.geminiApiKey,
        model: settings.model,
      });
      await saveDossier({ ...next, entryCount: done.length });
    }
    aiReportError(undefined);
  } catch (err) {
    // the next change or tick tries again; meanwhile the corpus screen says what went wrong
    aiReportError(describeError(err));
  } finally {
    running = false;
    aiJobDone();
  }
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'daily quota') return 'quota-day';
  if (message === 'rate limited') return 'quota-minute';
  if (err instanceof DOMException && err.name === 'TimeoutError') return 'timeout';
  if (err instanceof TypeError || !navigator.onLine) return 'offline';
  if (/API key|API_KEY|PERMISSION_DENIED|40[13]/.test(message)) return 'key';
  return message.slice(0, 160);
}

export async function refreshDossier(): Promise<void> {
  const settings = await ensureSettings();
  const corpus = await latestCorpus();
  if (!corpus || !settings.geminiApiKey) return;
  aiJobQueued();
  try {
    const done = await db.entries.where('ai.status').equals('done').toArray();
    const next = await writeDossier({
      corpus,
      entries: done,
      projects: await db.projects.toArray(),
      previous: await latestDossier(),
      styleGuide: settings.styleGuide,
      apiKey: settings.geminiApiKey,
      model: settings.model,
    });
    await saveDossier({ ...next, entryCount: done.length });
  } finally {
    aiJobDone();
  }
}
