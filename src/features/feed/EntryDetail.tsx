import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { retryEntry } from '../../ai/queue';
import { CategoryChips } from '../../components/CategoryChips';
import { TextChoice } from '../../components/TextChoice';
import { getAudioBlob } from '../../db/audio';
import { effectiveCategories, effectiveProjectId, effectiveTags } from '../../db/effective';
import {
  deleteEntry,
  overrideCategories,
  overrideProjectId,
  overrideTags,
  updateEntry,
  useChildren,
  useEntry,
} from '../../db/entries';
import { useProjects } from '../../db/projects';
import type { Category, Entry } from '../../db/types';
import { formatDateTime } from '../../utils/format';
import styles from './EntryDetail.module.css';

interface Props {
  entryId: string;
  onClose: () => void;
  onNavigate: (entryId: string) => void;
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

export function EntryDetail({ entryId, onClose, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const entry = useEntry(entryId);
  const parent = useEntry(entry?.parentEntryId);
  const children = useChildren(entryId);
  const audioUrl = useAudioUrl(entry?.audioId);
  const projects = useProjects();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagsDraft, setTagsDraft] = useState<string | null>(null);
  const [categoriesDraft, setCategoriesDraft] = useState<Category[] | null>(null);

  useEffect(() => {
    setCategoriesDraft(null);
    setTagsDraft(null);
  }, [entryId]);

  if (!entry) return null;

  function handleCategoriesChange(categories: Category[]) {
    setCategoriesDraft(categories);
    void overrideCategories(entryId, categories);
  }

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

        {parent && (
          <button type="button" className={styles.threadLink} onClick={() => onNavigate(parent.id)}>
            ← {parent.title || parent.text || parent.transcript || t('feed.voicePlaceholder')}
          </button>
        )}

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

        {entry.ai.status === 'error' && (
          <div className={styles.field}>
            <span className={styles.label}>{t('detail.aiError')}</span>
            <span>{entry.ai.error}</span>
            <button type="button" className={styles.backButton} onClick={() => retryEntry(entryId)}>
              {t('detail.retry')}
            </button>
          </div>
        )}

        {entry.ai.summary && (
          <div className={styles.field}>
            <span className={styles.label}>{t('detail.aiSummary')}</span>
            <span>{entry.ai.summary}</span>
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}>{t('capture.categoriesLabel')}</span>
          <CategoryChips
            value={categoriesDraft ?? effectiveCategories(entry)}
            onChange={handleCategoriesChange}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="detail-project">
            {t('capture.projectLabel')}
          </label>
          <select
            id="detail-project"
            className={styles.input}
            value={effectiveProjectId(entry) ?? ''}
            onChange={(e) => overrideProjectId(entryId, e.target.value || undefined)}
          >
            <option value="">{t('settings.projects.noActiveProject')}</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="detail-tags">
            {t('capture.tagsLabel')}
          </label>
          <input
            id="detail-tags"
            className={styles.input}
            value={tagsDraft ?? effectiveTags(entry).join(', ')}
            onChange={(e) => setTagsDraft(e.target.value)}
            onBlur={(e) => {
              overrideTags(
                entryId,
                e.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              );
              setTagsDraft(null);
            }}
          />
        </div>

        <TextChoice
          prefix={t('capture.importanceLabel')}
          options={[
            { value: 1, label: t('capture.importanceLow') },
            { value: 2, label: t('capture.importanceMid') },
            { value: 3, label: t('capture.importanceHigh') },
          ]}
          value={entry.importance}
          onChange={handleImportance}
        />

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

        {children && children.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>{t('detail.linkedEntries')}</span>
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                className={styles.threadLink}
                onClick={() => onNavigate(child.id)}
              >
                {child.title || child.text || child.transcript || t('feed.voicePlaceholder')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
