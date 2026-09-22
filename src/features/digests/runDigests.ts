import { generateDigest } from '../../ai/digest';
import { db } from '../../db/db';
import { createDigest } from '../../db/digests';
import { ensureSettings, updateSettings } from '../../db/settings';
import { previousWeekRange, shouldRunWeeklyDigest } from '../../utils/digestSchedule';
import { generateAudioLog } from '../audiolog/generateAudioLog';

/**
 * Once a week: a short digest of the week and, if nothing was logged meanwhile, the next Audio Log.
 * The daily digest was retired: the corpus now says every day what it would have said.
 */
export async function runDueDigests(): Promise<void> {
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey) return;
  if (!shouldRunWeeklyDigest(settings.lastWeeklyDigestAt)) return;

  const { start, end } = previousWeekRange();
  const entries = (await db.entries.where('ai.status').equals('done').toArray()).filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  if (entries.length > 0) {
    try {
      const body = await generateDigest(entries, await db.projects.toArray(), 'weekly', settings.geminiApiKey, settings.model);
      await createDigest('weekly', start.toISOString(), body, entries.map((e) => e.id));
    } catch {
      // best-effort; try again next launch
    }
  }
  try {
    await generateAudioLog(settings);
  } catch {
    // best-effort; it can still be prepared by hand from the Audio Log layer
  }
  await updateSettings({ lastWeeklyDigestAt: new Date().toISOString() });
}
