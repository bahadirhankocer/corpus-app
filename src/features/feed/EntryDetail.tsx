import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getAudioBlob } from '../../db/audio';
import { deleteEntry, updateEntry, useEntry } from '../../db/entries';
import type { Entry } from '../../db/types';
import { SegmentedControl } from '../../components/SegmentedControl';
import { formatDateTime } from '../../utils/format';
import styles from './EntryDetail.module.css';

interface Props {
  entryId: string;
  onClose: () => void;
}

function useAudioUrl(audioId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (audioId) {
      getAudioBlob(audioId).then((audio) => {
        if (audio) {
          objectUrl = URL.createObjectURL(audio.blob);
          setUrl(objectUrl);
        }
      });
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audioId]);

  return url;
}

export function EntryDetail({ entryId, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const entry = useEntry(entryId);
  const audioUrl = useAudioUrl(entry?.audioId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!entry) return null;

  function handleField<K extends keyof Pick<Entry, 'text' | 'title' | 'context'>>(field: K, value: string) {
    void updateEntry(entryId, { [field]: value } as Pick<Entry, K>);
  }

  function handleImportance(value: 1 | 2 | 3) {
    void updateEntry(entryId, { importance: value });
  }

  async function handleDelete() {
    await deleteEntry(entryId);
    onClose();
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onClose}>
          {t('common.back')}
        </button>
        <button type="button" className={styles.deleteButton} onClick={() => setConfirmDelete(true)}>
          {t('common.delete')}
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          {formatDateTime(entry.createdAt, i18n.language)} · {t(`feed.aiStatus.${entry.ai.status}`)}
        </div>

        {confirmDelete && (
          <div className={styles.confirm}>
            <span>{t('detail.confirmDelete')}</span>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancel} onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={styles.confirmDelete} onClick={handleDelete}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        )}

        {entry.kind === 'voice' && audioUrl && (
          <div className={styles.field}>
            <span className={styles.label}>{t('feed.kindVoice')}</span>
            <audio controls src={audioUrl} />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="detail-title">
            {t('capture.titleLabel')}
          </label>
          <input
            id="detail-title"
            className={styles.input}
            defaultValue={entry.title ?? ''}
            onBlur={(e) => handleField('title', e.target.value)}
          />
        </div>

        {entry.kind === 'text' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="detail-text">
              {t('capture.textLabel')}
            </label>
            <textarea
              id="detail-text"
              className={styles.textarea}
              defaultValue={entry.text ?? ''}
              onBlur={(e) => handleField('text', e.target.value)}
            />
          </div>
        )}

        {entry.kind === 'voice' && (
          <div className={styles.field}>
            <span className={styles.label}>{t('detail.transcript')}</span>
            <span>{entry.transcript ?? t('detail.noTranscriptYet')}</span>
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}>{t('capture.importanceLabel')}</span>
          <SegmentedControl
            options={[
              { value: 1, label: t('capture.importanceLow') },
              { value: 2, label: t('capture.importanceMid') },
              { value: 3, label: t('capture.importanceHigh') },
            ]}
            value={entry.importance}
            onChange={handleImportance}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="detail-context">
            {t('capture.contextLabel')}
          </label>
          <input
            id="detail-context"
            className={styles.input}
            defaultValue={entry.context ?? ''}
            onBlur={(e) => handleField('context', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
