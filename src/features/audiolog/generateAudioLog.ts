import { generateAudioLogDraft, rewriteFlaggedParagraphs } from '../../ai/audiolog';
import { lintAudioLogDraft, lintParagraphText } from '../../audiolog/lint';
import { allTitles, createAudioLog } from '../../db/audiologs';
import { latestCorpus } from '../../db/corpus';
import { db } from '../../db/db';
import type { AudioLog, Settings } from '../../db/types';

const REWRITE_PASSES = 2;

/** Mechanical fixes that never need a model: dashes and stray bracketed cues. */
function tidy(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/ ,/g, ',')
    .replace(/,\s*([.,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function rangeLabel(start: Date, end: Date, lang: 'tr' | 'en'): string {
  const fmt = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Writes the next Audio Log, finished. The first log covers everything written so far; every later one
 * starts where the previous one ended. Style problems are fixed silently, so there is nothing to revise.
 */
export async function generateAudioLog(settings: Settings): Promise<AudioLog | undefined> {
  if (!settings.aiEnabled || !settings.geminiApiKey) return undefined;

  const logs = await db.audioLogs.toArray();
  const last = logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const from = last ? new Date(last.rangeEnd ?? last.createdAt) : new Date(0);
  const to = new Date();

  const entries = (await db.entries.where('ai.status').equals('done').toArray()).filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  if (entries.length === 0) return undefined;

  const first = entries.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), entries[0].createdAt);
  const lang = settings.audioLog.lang;
  const baseTarget = settings.audioLog.targetMinutes * settings.audioLog.wordsPerMinute;
  // A log that covers many entries may run longer, so no entry has to be dropped.
  const targetWords = Math.max(baseTarget, Math.min(entries.length * 32, baseTarget * 2));

  const draft = await generateAudioLogDraft({
    entries,
    links: await db.links.toArray(),
    projects: await db.projects.toArray(),
    corpus: await latestCorpus(),
    rangeLabel: rangeLabel(new Date(first), to, lang),
    styleGuide: settings.styleGuide,
    targetWords,
    previousTitles: await allTitles(),
    cues: settings.audioLog.cues,
    lang,
    apiKey: settings.geminiApiKey,
    model: settings.model,
  });

  draft.paragraphs.forEach((p) => (p.text = tidy(p.text)));

  for (let pass = 0; pass < REWRITE_PASSES; pass++) {
    const flagged = draft.paragraphs
      .map((p, index) => ({ index, text: p.text, issues: lintParagraphText(p.text, lang) }))
      .filter((f) => f.issues.length > 0);
    if (flagged.length === 0) break;
    try {
      const rewrites = await rewriteFlaggedParagraphs(flagged, settings.styleGuide, lang, settings.geminiApiKey, settings.model);
      rewrites.forEach((text, index) => {
        if (draft.paragraphs[index]) draft.paragraphs[index].text = tidy(text);
      });
    } catch {
      break;
    }
  }

  const { warnings, errors } = lintAudioLogDraft(draft.paragraphs, lang, targetWords);

  return createAudioLog({
    number: settings.audioLog.nextNumber,
    title: draft.title.toUpperCase(),
    weekStart: first,
    rangeEnd: to.toISOString(),
    lang,
    version: 1,
    paragraphs: draft.paragraphs,
    patreonIntro: tidy(draft.patreonIntro),
    lintWarnings: [...errors, ...warnings],
  });
}
