import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TextChoice } from '../../components/TextChoice';
import { setAudioLogStatus, updateAudioLog, useAudioLog } from '../../db/audiologs';
import { updateSettings, useSettings } from '../../db/settings';
import type { AudioLog } from '../../db/types';
import { downloadTextFile } from '../../utils/download';
import { useBackHandler } from '../../app/backStack';
import styles from './AudioLogEditor.module.css';
import { ReadingMode } from './ReadingMode';

interface Props {
  audioLogId: string;
  onClose: () => void;
}

function buildMarkdown(log: AudioLog): string {
  const lines = [`# AUDIO LOG ${String(log.number).padStart(3, '0')} — ${log.title}`, ''];
  for (const p of log.paragraphs) {
    lines.push(p.text);
    if (p.cue) lines.push(`[${p.cue}]`);
    lines.push('');
  }
  return lines.join('\n');
}

function buildTxt(log: AudioLog): string {
  return log.paragraphs.map((p) => p.text).join('\n\n');
}

export function AudioLogEditor({ audioLogId, onClose }: Props) {
  const { t } = useTranslation();
  const log = useAudioLog(audioLogId);
  const settings = useSettings();
  const [reading, setReading] = useState(false);
  useBackHandler(true, onClose);

  if (!log) return null;

  function handleTitle(value: string) {
    void updateAudioLog(audioLogId, { title: value });
  }

  function handlePatreonIntro(value: string) {
    void updateAudioLog(audioLogId, { patreonIntro: value });
  }

  function handleParagraphText(index: number, value: string) {
    const paragraphs = log!.paragraphs.map((p, i) => (i === index ? { ...p, text: value } : p));
    void updateAudioLog(audioLogId, { paragraphs });
  }

  async function handleStatus(status: AudioLog['status']) {
    await setAudioLogStatus(audioLogId, status);
    if (status === 'final' && log!.status !== 'final' && settings) {
      await updateSettings({ audioLog: { ...settings.audioLog, nextNumber: settings.audioLog.nextNumber + 1 } });
    }
  }

  function handleExportMd() {
    downloadTextFile(`AUDIO-LOG-${String(log!.number).padStart(3, '0')}-${log!.title}.md`, buildMarkdown(log!), 'text/markdown');
  }

  function handleExportTxt() {
    downloadTextFile(`AUDIO-LOG-${String(log!.number).padStart(3, '0')}-${log!.title}.txt`, buildTxt(log!), 'text/plain');
  }

  function handleExportPatreon() {
    downloadTextFile(`AUDIO-LOG-${String(log!.number).padStart(3, '0')}-patreon.txt`, log!.patreonIntro, 'text/plain');
  }

  if (reading) {
    return <ReadingMode audioLog={log} onClose={() => setReading(false)} />;
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
        <input
          className={styles.titleInput}
          value={log.title}
          onChange={(e) => handleTitle(e.target.value)}
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

        <div className={styles.field}>
          <span className={styles.label}>{t('audiolog.paragraphs')}</span>
          {log.paragraphs.map((p, i) => (
            <div key={i} className={styles.paragraph}>
              <textarea
                className={styles.paragraphText}
                value={p.text}
                onChange={(e) => handleParagraphText(i, e.target.value)}
              />
              <div className={styles.paragraphFooter}>
                <span className={styles.sources}>
                  {t('audiolog.sourceCount', { count: p.sourceEntryIds.length })}
                </span>
                {p.cue && <span className={styles.sources}>[{p.cue}]</span>}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="patreon-intro">
            {t('audiolog.patreonIntro')}
          </label>
          <textarea
            id="patreon-intro"
            className={styles.textarea}
            value={log.patreonIntro}
            onChange={(e) => handlePatreonIntro(e.target.value)}
          />
        </div>

        <div className={styles.exportRow}>
          <button type="button" className={styles.exportButton} onClick={handleExportMd}>
            {t('audiolog.exportMd')}
          </button>
          <button type="button" className={styles.exportButton} onClick={handleExportTxt}>
            {t('audiolog.exportTxt')}
          </button>
          <button type="button" className={styles.exportButton} onClick={handleExportPatreon}>
            {t('audiolog.exportPatreon')}
          </button>
        </div>
      </div>
    </div>
  );
}
