import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AutoText } from '../../components/AutoText';
import { TextChoice } from '../../components/TextChoice';
import { setAudioLogStatus, updateAudioLog, useAudioLog } from '../../db/audiologs';
import { updateSettings, useSettings } from '../../db/settings';
import type { AudioLog, Lang } from '../../db/types';
import { asLang, audioLogView, upper } from '../../i18n/localize';
import type { AudioLogView } from '../../i18n/localize';
import { downloadTextFile } from '../../utils/download';
import { useBackHandler } from '../../app/backStack';
import { saveAudioLogToDocs, useDocsStatus } from '../export/googleDocs';
import styles from './AudioLogEditor.module.css';
import { ReadingMode } from './ReadingMode';
import { useAudioLogTranslation } from './translateAudioLog';

interface Props {
  audioLogId: string;
  onClose: () => void;
}

function logNumber(log: AudioLog): string {
  return String(log.number).padStart(3, '0');
}

function buildMarkdown(log: AudioLog, view: AudioLogView): string {
  const lines = [`# AUDIO LOG ${logNumber(log)} — ${view.title}`, ''];
  for (const p of view.paragraphs) {
    lines.push(p.text);
    if (p.cue) lines.push(`[${p.cue}]`);
    lines.push('');
  }
  return lines.join('\n');
}

function period(log: AudioLog, lang: Lang): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long' });
  return `${fmt(log.weekStart)} – ${fmt(log.rangeEnd ?? log.createdAt)}`;
}

export function AudioLogEditor({ audioLogId, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const lang = asLang(i18n.language);
  const log = useAudioLog(audioLogId);
  const settings = useSettings();
  const docs = useDocsStatus();
  const [reading, setReading] = useState(false);
  useBackHandler(true, onClose);
  const view = log ? audioLogView(log, lang) : undefined;
  useAudioLogTranslation(log, lang, Boolean(view?.needsTranslation));

  if (!log || !view) return null;

  /** Edits go to whatever is on screen: the original, or its translation. */
  function edit(change: { title?: string; patreonIntro?: string; paragraph?: { index: number; text: string } }) {
    const { title, patreonIntro, paragraph } = change;
    if (view!.translated) {
      const current = log!.translations![lang]!;
      const next = {
        ...current,
        title: title ?? current.title,
        patreonIntro: patreonIntro ?? current.patreonIntro,
        paragraphs: paragraph
          ? current.paragraphs.map((p, i) => (i === paragraph.index ? { ...p, text: paragraph.text } : p))
          : current.paragraphs,
      };
      void updateAudioLog(audioLogId, { translations: { ...log!.translations, [lang]: next } });
      return;
    }
    void updateAudioLog(audioLogId, {
      ...(title !== undefined && { title }),
      ...(patreonIntro !== undefined && { patreonIntro }),
      ...(paragraph && {
        paragraphs: log!.paragraphs.map((p, i) => (i === paragraph.index ? { ...p, text: paragraph.text } : p)),
      }),
    });
  }

  async function handleStatus(status: AudioLog['status']) {
    await setAudioLogStatus(audioLogId, status);
    if (status === 'final' && log!.status !== 'final' && settings) {
      await updateSettings({ audioLog: { ...settings.audioLog, nextNumber: settings.audioLog.nextNumber + 1 } });
    }
  }

  function handleExportMd() {
    downloadTextFile(`AUDIO-LOG-${logNumber(log!)}-${view!.title}.md`, buildMarkdown(log!, view!), 'text/markdown');
  }

  function handleExportPatreon() {
    downloadTextFile(`AUDIO-LOG-${logNumber(log!)}-patreon.txt`, view!.patreonIntro, 'text/plain');
  }

  if (reading) {
    return <ReadingMode paragraphs={view.paragraphs} onClose={() => setReading(false)} />;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onClose}>
          {t('common.back')}
        </button>
        <button type="button" className={styles.readingButton} onClick={() => setReading(true)}>
          {t('audiolog.readingMode')}
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span>AUDIO LOG {logNumber(log)}</span>
          <span>{period(log, lang)}</span>
          {view.needsTranslation && <span className={styles.translating}>{t('audiolog.translating')}</span>}
        </div>

        <AutoText
          className={styles.title}
          value={view.title}
          onChange={(value) => edit({ title: upper(value) })}
          spellCheck={false}
        />

        <TextChoice
          prefix={t('audiolog.statusLabel')}
          options={[
            { value: 'draft', label: t('audiolog.status.draft') },
            { value: 'final', label: t('audiolog.status.final') },
            { value: 'recorded', label: t('audiolog.status.recorded') },
            { value: 'published', label: t('audiolog.status.published') },
          ]}
          value={log.status}
          onChange={handleStatus}
        />

        <div className={styles.blocks}>
          {view.paragraphs.map((p, i) => (
            <section key={i} className={styles.block}>
              <div className={styles.blockMeta}>
                <span className={styles.number}>{String(i + 1).padStart(2, '0')}</span>
                <span>{t('audiolog.sourceCount', { count: p.sourceEntryIds.length })}</span>
              </div>
              <AutoText
                className={styles.paragraph}
                value={p.text}
                onChange={(value) => edit({ paragraph: { index: i, text: value } })}
              />
              {p.cue && <p className={styles.cue}>{p.cue}</p>}
            </section>
          ))}
        </div>

        <section className={styles.block}>
          <div className={styles.blockMeta}>
            <span className={styles.number}>{t('audiolog.patreonIntro')}</span>
          </div>
          <AutoText
            className={styles.intro}
            value={view.patreonIntro}
            onChange={(value) => edit({ patreonIntro: value })}
          />
        </section>

        <div className={styles.exportRow}>
          <button
            type="button"
            className={styles.docsButton}
            disabled={docs.state === 'working'}
            onClick={() => void saveAudioLogToDocs(audioLogId, lang, t('audiolog.patreonIntro'))}
          >
            {docs.state === 'working' ? t('docs.working') : t('audiolog.exportDocs')}
          </button>
          <button type="button" className={styles.exportButton} onClick={handleExportMd}>
            {t('audiolog.exportMd')}
          </button>
          <button type="button" className={styles.exportButton} onClick={handleExportPatreon}>
            {t('audiolog.exportPatreon')}
          </button>
        </div>
      </div>
    </div>
  );
}
