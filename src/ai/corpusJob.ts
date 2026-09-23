import { writeCorpus } from './corpus';
import { writeDossier } from './dossier';
import { drawMap } from './map';
import { aiJobDone, aiJobQueued, aiReportError } from './status';
import { addNotes, latestCorpus, latestDossier, saveCorpus, saveDossier, setMorningNote } from '../db/corpus';
import { db } from '../db/db';
import { latestMap, saveMap } from '../db/maps';
import { ensureSettings } from '../db/settings';
import type { Bi, Entry } from '../db/types';
import { entryHeadline, upper } from '../i18n/localize';
import { schedulePing } from '../features/push/push';

const DEBOUNCE_MS = 40_000;
const MIN_RETRY_MS = 90_000;
const DOSSIER_EVERY_ENTRIES = 4;
const DOSSIER_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const ECHO_MIN_MS = 60 * 60 * 1000;
const ECHO_MAX_MS = 3 * 60 * 60 * 1000;
const MAP_NEW_ENTRIES = 3;
const MAP_MAX_AGE_MS = 6 * 60 * 60 * 1000;

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
    void refreshMap();
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

let mapRunning = false;
let lastMapAttempt = 0;

/**
 * Redraws the map after a few new entries, or when something changed and the map is hours old.
 * `force` is the redraw button.
 */
export async function refreshMap(options: { force?: boolean } = {}): Promise<boolean> {
  if (mapRunning) return false;
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey || !navigator.onLine) return false;
  const done = await db.entries.where('ai.status').equals('done').toArray();
  if (done.length === 0) return false;

  const sig = sourceSig(done);
  const previous = await latestMap();
  if (!options.force) {
    if (previous?.sourceSig === sig) return false;
    if (Date.now() - lastMapAttempt < MIN_RETRY_MS) return false;
    const unmapped = previous ? done.filter((e) => !previous.headlines[e.id]).length : done.length;
    const age = previous ? Date.now() - new Date(previous.createdAt).getTime() : Infinity;
    if (previous && unmapped < MAP_NEW_ENTRIES && age < MAP_MAX_AGE_MS) return false;
  }

  mapRunning = true;
  lastMapAttempt = Date.now();
  aiJobQueued();
  try {
    const draft = await drawMap({
      entries: done,
      projects: await db.projects.toArray(),
      corpus: await latestCorpus(),
      previous,
      styleGuide: settings.styleGuide,
      apiKey: settings.geminiApiKey,
      model: settings.model,
    });
    if (draft.clusters.length === 0) return false;

    // Anything the model left out joins the cluster of an entry it is linked to, or the last one.
    const clusterOf = new Map(draft.clusters.flatMap((c, i) => c.entryIds.map((id) => [id, i] as const)));
    const links = await db.links.toArray();
    for (const entry of done) {
      if (!clusterOf.has(entry.id)) {
        const linked = links
          .filter((l) => l.state !== 'dismissed' && (l.fromId === entry.id || l.toId === entry.id))
          .map((l) => clusterOf.get(l.fromId === entry.id ? l.toId : l.fromId))
          .find((i) => i !== undefined);
        const index = linked ?? draft.clusters.length - 1;
        draft.clusters[index].entryIds.push(entry.id);
        clusterOf.set(entry.id, index);
      }
      if (!draft.headlines[entry.id]) {
        const short = (lang: 'tr' | 'en') => upper(entryHeadline(entry, lang).split(/\s+/).slice(0, 4).join(' '));
        draft.headlines[entry.id] = { tr: short('tr'), en: short('en') } satisfies Bi;
      }
    }

    await saveMap({ ...draft, sourceSig: sig, entryCount: done.length });
    return true;
  } catch (err) {
    aiReportError(describeError(err));
    return false;
  } finally {
    mapRunning = false;
    aiJobDone();
  }
}
