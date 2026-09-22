import { classifyEntry } from './classify';
import { scheduleCorpus } from './corpusJob';
import { generateFollowUp } from './followup';
import { GeminiRateLimitError } from './gemini';
import { findLinks } from './links';
import { translateEntry } from './translate';
import { getAudioBlob } from '../db/audio';
import { db } from '../db/db';
import { createFollowUp } from '../db/followups';
import { createSuggestedLink } from '../db/links';
import { ensureSettings } from '../db/settings';
import type { Entry } from '../db/types';
import { entrySignature } from '../i18n/localize';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
const LINK_CANDIDATE_LIMIT = 50;
const MAX_FOLLOWUPS_PER_ENTRY = 3;

let running = false;
/** Entries whose enrichment failed for a non-transient reason in this session. */
const skipped = new Set<string>();

/** Rate-limit and network problems abort the chain so it is retried later; anything else is skipped. */
function isRetryable(err: unknown): boolean {
  return err instanceof GeminiRateLimitError || err instanceof TypeError || !navigator.onLine;
}

async function stepTranslate(entry: Entry, apiKey: string, model: string): Promise<void> {
  const signature = entrySignature(entry);
  if (entry.i18nFor === signature) return;
  const result = await translateEntry(entry, apiKey, model);
  await db.entries.update(entry.id, {
    lang: result.lang,
    i18n: { tr: result.tr, en: result.en },
    i18nFor: signature,
    'ai.summary': result[result.lang].summary || entry.ai.summary,
  });
}

/** Each answer earns one deeper question, up to a few per entry. */
async function stepFollowUp(entry: Entry, apiKey: string, model: string): Promise<void> {
  const asked = await db.followups.where('entryId').equals(entry.id).toArray();
  if (asked.some((f) => f.status === 'pending') || asked.length >= MAX_FOLLOWUPS_PER_ENTRY) return;
  if (asked.length > (entry.thread?.length ?? 0)) return;
  const result = await generateFollowUp(entry, apiKey, model);
  await createFollowUp(entry.id, result);
}

async function stepLinks(entry: Entry, apiKey: string, model: string): Promise<void> {
  // Links are looked for once, when the entry is new; answers only deepen it.
  if ((entry.thread?.length ?? 0) > 0) return;
  const candidates = (await db.entries.where('ai.status').equals('done').reverse().sortBy('createdAt'))
    .filter((c) => c.id !== entry.id)
    .slice(0, LINK_CANDIDATE_LIMIT);
  const suggestions = await findLinks(entry, candidates, apiKey, model);
  for (const s of suggestions) {
    await createSuggestedLink(entry.id, s.toId, s.kind, s.rationale);
  }
}

async function enrichOne(): Promise<'done' | 'empty' | 'retry'> {
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey || !navigator.onLine) return 'retry';

  const done = (await db.entries.where('ai.status').equals('done').toArray()).filter((e) => !skipped.has(e.id));
  const entry =
    done.find((e) => e.ai.enriched === false) ?? done.find((e) => e.i18nFor !== entrySignature(e));
  if (!entry) return 'empty';

  const { geminiApiKey: apiKey, model } = settings;
  const steps: (() => Promise<void>)[] = [() => stepTranslate(entry, apiKey, model)];
  if (entry.ai.enriched === false) {
    steps.push(() => stepFollowUp(entry, apiKey, model), () => stepLinks(entry, apiKey, model));
  }
  for (const step of steps) {
    try {
      await step();
    } catch (err) {
      if (isRetryable(err)) return 'retry';
      // any other failure only costs that one enhancement; it is tried again next session
      skipped.add(entry.id);
    }
  }
  await db.entries.update(entry.id, { 'ai.enriched': true });
  return 'done';
}

let enriching = false;

/** Translation, follow-up and links for every processed entry, one at a time, then a new corpus. */
export async function kickEnrichment(): Promise<void> {
  if (enriching) return;
  enriching = true;
  let changed = false;
  try {
    for (;;) {
      const outcome = await enrichOne();
      if (outcome !== 'done') break;
      changed = true;
    }
  } finally {
    enriching = false;
  }
  if (changed) scheduleCorpus();
}

async function processOne(): Promise<'processed' | 'empty' | 'skipped'> {
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey) return 'skipped';
  if (!navigator.onLine) return 'skipped';

  const entry = await db.entries.where('ai.status').equals('pending').first();
  if (!entry) return 'empty';

  await db.entries.update(entry.id, { 'ai.status': 'processing' });

  const projects = await db.projects.where('status').equals('active').toArray();
  const audioBlob = entry.audioId ? (await getAudioBlob(entry.audioId))?.blob : undefined;

  let backoff = MIN_BACKOFF_MS;
  for (;;) {
    try {
      const result = await classifyEntry(entry, audioBlob, projects, settings.geminiApiKey, settings.model);
      const transcript = result.transcript || entry.transcript;
      await db.entries.update(entry.id, {
        transcript,
        updatedAt: new Date().toISOString(),
        lang: result.lang,
        i18n: { tr: result.tr, en: result.en },
        i18nFor: entrySignature({ ...entry, transcript }),
        'ai.status': 'done',
        'ai.categories': result.categories,
        'ai.projectId': result.projectId ?? undefined,
        'ai.projectConfidence': result.projectConfidence,
        'ai.tags': result.tags,
        'ai.summary': result.summary,
        'ai.processedAt': new Date().toISOString(),
        'ai.error': undefined,
        'ai.enriched': false,
        'sync.dirty': true,
      });
      return 'processed';
    } catch (err) {
      if (err instanceof GeminiRateLimitError) {
        await new Promise((resolve) => window.setTimeout(resolve, backoff));
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        if (!navigator.onLine) {
          await db.entries.update(entry.id, { 'ai.status': 'pending' });
          return 'skipped';
        }
        continue;
      }
      await db.entries.update(entry.id, {
        'ai.status': 'error',
        'ai.error': err instanceof Error ? err.message : String(err),
        'ai.processedAt': new Date().toISOString(),
      });
      return 'processed';
    }
  }
}

export async function kickAiQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const outcome = await processOne();
      if (outcome === 'empty' || outcome === 'skipped') break;
    }
  } finally {
    running = false;
  }
  void kickEnrichment();
}

export function retryEntry(id: string): Promise<void> {
  return db.entries.update(id, { 'ai.status': 'pending', 'ai.error': undefined }).then(() => kickAiQueue());
}
