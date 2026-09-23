import { useEffect } from 'react';

import { translateAudioLogText } from '../../ai/audiolog';
import { tidy } from '../../audiolog/tidy';
import { db } from '../../db/db';
import { ensureSettings } from '../../db/settings';
import type { AudioLog, Lang } from '../../db/types';
import { audioLogSignature } from '../../i18n/localize';

const running = new Set<string>();
const failed = new Set<string>();

/** Writes the log in `lang` when that version is missing or older than the original. */
export async function ensureAudioLogTranslation(id: string, lang: Lang): Promise<void> {
  const key = `${id}:${lang}`;
  if (running.has(key)) return;
  const settings = await ensureSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey) return;
  const log = await db.audioLogs.get(id);
  if (!log || log.lang === lang) return;
  const sig = audioLogSignature(log);
  if (log.translations?.[lang]?.sourceSig === sig || failed.has(`${key}:${sig}`)) return;

  running.add(key);
  try {
    const text = await translateAudioLogText(
      { title: log.title, paragraphs: log.paragraphs, patreonIntro: log.patreonIntro, lang: log.lang },
      lang,
      settings.styleGuide,
      settings.geminiApiKey,
      settings.model,
    );
    const fresh = await db.audioLogs.get(id);
    // He edited the original meanwhile; the next look asks again.
    if (!fresh || audioLogSignature(fresh) !== sig) return;
    await db.audioLogs.update(id, {
      translations: {
        ...fresh.translations,
        [lang]: {
          title: text.title,
          paragraphs: text.paragraphs.map((p) => ({ text: tidy(p.text), cue: p.cue })),
          patreonIntro: tidy(text.patreonIntro),
          sourceSig: sig,
        },
      },
    });
  } catch {
    // not retried until the original changes or the app restarts
    failed.add(`${key}:${sig}`);
  } finally {
    running.delete(key);
  }
}

/** Keeps the visible log in the interface language. */
export function useAudioLogTranslation(log: AudioLog | undefined, lang: Lang, needed: boolean): void {
  const id = log?.id;
  useEffect(() => {
    if (id && needed) void ensureAudioLogTranslation(id, lang);
  }, [id, lang, needed]);
}
