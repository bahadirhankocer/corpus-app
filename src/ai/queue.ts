import { classifyEntry } from './classify';
import { generateFollowUp } from './followup';
import { GeminiRateLimitError } from './gemini';
import { getAudioBlob } from '../db/audio';
import { db } from '../db/db';
import { createFollowUp, hasPendingFollowUp } from '../db/followups';
import { ensureSettings } from '../db/settings';
import type { Entry } from '../db/types';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

let running = false;

async function maybeGenerateFollowUp(entry: Entry, apiKey: string, model: string): Promise<void> {
  try {
    if (await hasPendingFollowUp(entry.id)) return;
    const result = await generateFollowUp(entry, apiKey, model);
    await createFollowUp(entry.id, result.question, result.options);
  } catch {
    // best-effort enhancement; classification already succeeded, don't surface this failure
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
        'sync.dirty': true,
      });
      void maybeGenerateFollowUp(
        {
          ...entry,
          transcript: result.transcript || entry.transcript,
          ai: { ...entry.ai, categories: result.categories, tags: result.tags, summary: result.summary },
        },
        settings.geminiApiKey,
        settings.model,
      );
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
}

export function retryEntry(id: string): Promise<void> {
  return db.entries.update(id, { 'ai.status': 'pending', 'ai.error': undefined }).then(() => kickAiQueue());
}
