import { classifyEntry } from './classify';
import { generateFollowUp } from './followup';
import { GeminiRateLimitError } from './gemini';
import { findLinks } from './links';
import { reflectOnEntry } from './reflect';
import { getAudioBlob } from '../db/audio';
import { db } from '../db/db';
import { createFollowUp, hasPendingFollowUp } from '../db/followups';
import { effectiveProjectId } from '../db/effective';
import { createSuggestedLink } from '../db/links';
import { addThoughts } from '../db/thoughts';
import { ensureSettings } from '../db/settings';
import type { Entry } from '../db/types';
import { updateProject } from '../db/projects';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
const LINK_CANDIDATE_LIMIT = 50;

let running = false;

const NEIGHBOR_LIMIT = 25;

/** Rate-limit and network problems abort the chain so it is retried later; anything else is skipped. */
function isRetryable(err: unknown): boolean {
  return err instanceof GeminiRateLimitError || err instanceof TypeError || !navigator.onLine;
}

async function stepFollowUp(entry: Entry, apiKey: string, model: string): Promise<void> {
  if (await hasPendingFollowUp(entry.id)) return;
  const result = await generateFollowUp(entry, apiKey, model);
  await createFollowUp(entry.id, result.question, result.options);
}

async function stepLinks(entry: Entry, projectId: string | undefined, apiKey: string, model: string): Promise<void> {
  if (!projectId) return;
  const candidates = (await db.entries.where('ai.projectId').equals(projectId).reverse().sortBy('createdAt'))
    .filter((c) => c.id !== entry.id && c.ai.status === 'done')
    .slice(0, LINK_CANDIDATE_LIMIT);
  const suggestions = await findLinks(entry, candidates, apiKey, model);
  for (const s of suggestions) {
    await createSuggestedLink(entry.id, s.toId, s.kind, s.rationale);
  }
}

async function stepReflect(entry: Entry, projectId: string | undefined, styleGuide: string, apiKey: string, model: string): Promise<void> {
  const project = projectId ? await db.projects.get(projectId) : undefined;
  const pool = (await db.entries.where('ai.status').equals('done').reverse().sortBy('createdAt')).filter(
    (e) => e.id !== entry.id && (projectId ? effectiveProjectId(e) === projectId : true),
  );
  const result = await reflectOnEntry({
    entry,
    project,
    neighbors: pool.slice(0, NEIGHBOR_LIMIT),
    styleGuide,
    apiKey,
    model,
  });
  await addThoughts(
    result.thoughts.map((t) => ({ kind: t.kind, text: t.text, entryIds: t.relatedIds, projectId })),
  );
  if (project && result.compendium) {
    await updateProject(project.id, { compendium: result.compendium, compendiumUpdatedAt: new Date().toISOString() });
  }
}

async function enrichOne(): Promise<'done' | 'empty' | 'retry'> {
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey || !navigator.onLine) return 'retry';

  const entry = await db.entries
    .where('ai.status')
    .equals('done')
    .filter((e) => e.ai.enriched === false)
    .first();
  if (!entry) return 'empty';

  const { geminiApiKey: apiKey, model, styleGuide } = settings;
  const projectId = effectiveProjectId(entry);
  const steps: (() => Promise<void>)[] = [
    () => stepFollowUp(entry, apiKey, model),
    () => stepLinks(entry, projectId, apiKey, model),
    () => stepReflect(entry, projectId, styleGuide, apiKey, model),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (err) {
      if (isRetryable(err)) return 'retry';
      // any other failure only costs that one enhancement
    }
  }
  await db.entries.update(entry.id, { 'ai.enriched': true });
  return 'done';
}

let enriching = false;

/** Follow-up, links and reflection for every processed entry, one entry at a time, in the background. */
export async function kickEnrichment(): Promise<void> {
  if (enriching) return;
  enriching = true;
  try {
    for (;;) {
      const outcome = await enrichOne();
      if (outcome !== 'done') break;
    }
  } finally {
    enriching = false;
  }
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
      await db.entries.update(entry.id, {
        transcript: result.transcript || entry.transcript,
        updatedAt: new Date().toISOString(),
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
      void kickEnrichment();
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
