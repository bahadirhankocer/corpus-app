import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from '../../ai/queue';
import { TextChoice } from '../../components/TextChoice';
import { saveAudioBlob } from '../../db/audio';
import { createEntry } from '../../db/entries';
import type { Entry } from '../../db/types';
import styles from './CaptureScreen.module.css';
import { type RecordedAudio, useAudioRecorder } from './useAudioRecorder';

type Mode = 'none' | 'text' | 'voice';

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CaptureScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('none');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<Entry['importance']>(2);
  const [context, setContext] = useState('');
  const [recorded, setRecorded] = useState<RecordedAudio | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const recorder = useAudioRecorder();
  const audioUrlRef = useRef<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (recorder.state !== 'recording') {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => window.clearInterval(id);
  }, [recorder.state]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  function reset() {
    setMode('none');
    setText('');
    setTitle('');
    setImportance(2);
    setContext('');
    setRecorded(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
  }

  async function handleStartVoice() {
    setMode('voice');
    await recorder.start();
  }

  async function handleStopRecording() {
    const result = await recorder.stop();
    if (result) {
      setRecorded(result);
      const url = URL.createObjectURL(result.blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
    }
  }

  async function handleReRecord() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setRecorded(null);
    await recorder.start();
  }

  const canSave = mode === 'text' ? text.trim().length > 0 : mode === 'voice' ? recorded !== null : false;

  async function handleSave() {
    if (!canSave) return;
    let audioId: string | undefined;
    if (mode === 'voice' && recorded) {
      audioId = await saveAudioBlob(recorded.blob, recorded.mime, recorded.durationSec);
    }
    await createEntry({
      kind: mode === 'voice' ? 'voice' : 'text',
      text: mode === 'text' ? text.trim() : undefined,
      audioId,
      title: title.trim() || undefined,
      importance,
      context: context.trim() || undefined,
    });
    reset();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
    void kickAiQueue();
  }

  function handleCancel() {
    if (recorder.state === 'recording') recorder.cancel();
    reset();
  }

  if (mode === 'none') {
    return (
      <div className={styles.hero}>
        <button type="button" className={styles.heroButton} onClick={() => setMode('text')}>
          {t('capture.writeButton')}
        </button>
        <button type="button" className={styles.heroButton} onClick={handleStartVoice}>
          {t('capture.recordButton')}
        </button>
        {savedFlash && <div className={styles.heroStatus}>{t('capture.saved')}</div>}
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" className={styles.cancelButton} onClick={handleCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className={styles.saveButton} disabled={!canSave} onClick={handleSave}>
          {t('common.save')}
        </button>
      </div>

      {mode === 'text' && (
        <textarea
          className={styles.textarea}
          placeholder={t('capture.textLabel')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      )}

      {mode === 'voice' && (
        <div className={styles.recordBox}>
          {recorder.state === 'recording' && (
            <>
              <span className={styles.timer}>{formatTimer(elapsed)}</span>
              <button type="button" className={styles.recordActionButton} onClick={handleStopRecording}>
                {t('capture.stopButton')}
              </button>
            </>
          )}
          {recorder.state !== 'recording' && audioUrl && (
            <>
              <audio controls src={audioUrl} />
              <span className={styles.timer}>{formatTimer(recorded?.durationSec ?? 0)}</span>
              <button type="button" className={styles.recordActionButton} onClick={handleReRecord}>
                {t('capture.reRecordButton')}
              </button>
            </>
          )}
          {recorder.error && <span className={styles.error}>{recorder.error}</span>}
        </div>
      )}

      <div className={styles.footer}>
        <input
          className={styles.plainInput}
          placeholder={t('capture.titleLabel')}
          aria-label={t('capture.titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className={styles.plainInput}
          placeholder={t('capture.contextLabel')}
          aria-label={t('capture.contextLabel')}
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />

        <TextChoice
          prefix={t('capture.importanceLabel')}
          options={[
            { value: 1, label: t('capture.importanceLow') },
            { value: 2, label: t('capture.importanceMid') },
            { value: 3, label: t('capture.importanceHigh') },
          ]}
          value={importance}
          onChange={setImportance}
        />
      </div>

      {savedFlash && <div className={styles.status}>{t('capture.saved')}</div>}
    </div>
  );
}
