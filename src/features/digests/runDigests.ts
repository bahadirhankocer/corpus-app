import { generateDigest } from '../../ai/digest';
import { db } from '../../db/db';
import { createDigest } from '../../db/digests';
import { ensureSettings, updateSettings } from '../../db/settings';
import {
  previousDayRange,
  previousWeekRange,
  shouldRunDailyDigest,
  shouldRunWeeklyDigest,
} from '../../utils/digestSchedule';
import { generateWeeklyAudioLog } from '../audiolog/generateAudioLog';

async function entriesInRange(start: Date, end: Date) {
  const all = await db.entries.where('ai.status').equals('done').toArray();
  return all.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

export async function runDueDigests(): Promise<void> {
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey) return;
  const projects = await db.projects.toArray();

  if (shouldRunDailyDigest(settings.lastDailyDigestAt)) {
    const { start, end } = previousDayRange();
    const entries = await entriesInRange(start, end);
    if (entries.length > 0) {
      try {
        const body = await generateDigest(entries, projects, 'daily', settings.lang, settings.geminiApiKey, settings.model);
        await createDigest('daily', start.toISOString(), body, entries.map((e) => e.id));
      } catch {
        // best-effort; try again next launch
      }
    }
    await updateSettings({ lastDailyDigestAt: new Date().toISOString() });
  }

  if (shouldRunWeeklyDigest(settings.lastWeeklyDigestAt)) {
    const { start, end } = previousWeekRange();
    const entries = await entriesInRange(start, end);
    if (entries.length > 0) {
      try {
        const body = await generateDigest(entries, projects, 'weekly', settings.lang, settings.geminiApiKey, settings.model);
        await createDigest('weekly', start.toISOString(), body, entries.map((e) => e.id));
      } catch {
        // best-effort; try again next launch
      }
    }
    try {
      await generateWeeklyAudioLog(settings);
    } catch {
      // best-effort; user can still trigger manually from the Audio Log screen
    }
    await updateSettings({ lastWeeklyDigestAt: new Date().toISOString() });
  }
}
