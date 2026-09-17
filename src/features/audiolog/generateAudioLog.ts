import { generateAudioLogDraft, rewriteFlaggedParagraphs } from '../../ai/audiolog';
import { lintAudioLogDraft, lintParagraphText } from '../../audiolog/lint';
import { allTitles, createAudioLog } from '../../db/audiologs';
import { db } from '../../db/db';
import type { AudioLog, Settings } from '../../db/types';
import { previousWeekRange } from '../../utils/digestSchedule';

export async function generateWeeklyAudioLog(settings: Settings): Promise<AudioLog | undefined> {
  if (!settings.aiEnabled || !settings.geminiApiKey) return undefined;

  const { start, end } = previousWeekRange();
  const allEntries = await db.entries.where('ai.status').equals('done').toArray();
  const weekEntries = allEntries.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  if (weekEntries.length === 0) return undefined;

  const previousTitles = await allTitles();
  const targetWords = settings.audioLog.targetMinutes * settings.audioLog.wordsPerMinute;
  const lang = settings.audioLog.lang;

  const draft = await generateAudioLogDraft(
    weekEntries,
    settings.styleGuide,
    targetWords,
    previousTitles,
    lang,
    settings.geminiApiKey,
    settings.model,
  );

  const flagged = draft.paragraphs
    .map((p, index) => ({ index, text: p.text, issues: lintParagraphText(p.text, lang) }))
    .filter((f) => f.issues.length > 0);

  if (flagged.length > 0) {
    try {
      const rewrites = await rewriteFlaggedParagraphs(flagged, settings.styleGuide, lang, settings.geminiApiKey, settings.model);
      rewrites.forEach((text, index) => {
        if (draft.paragraphs[index]) draft.paragraphs[index].text = text;
      });
    } catch {
      // keep originals if rewrite fails
    }
  }

  const { warnings, errors } = lintAudioLogDraft(draft.paragraphs, lang, targetWords);

  const audioLog = await createAudioLog({
    number: settings.audioLog.nextNumber,
    title: draft.title,
    weekStart: start.toISOString(),
    lang,
    version: 1,
    paragraphs: draft.paragraphs,
    patreonIntro: draft.patreonIntro,
    lintWarnings: [...errors, ...warnings],
  });

  return audioLog;
}
