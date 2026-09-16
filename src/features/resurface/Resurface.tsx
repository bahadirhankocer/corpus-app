import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from '../../ai/queue';
import { createEntry } from '../../db/entries';
import type { Entry } from '../../db/types';
import { formatRelativeTime } from '../../utils/relativeTime';
import styles from './Resurface.module.css';

interface Props {
  entry: Entry;
  onDone: () => void;
}

export function Resurface({ entry, onDone }: Props) {
  const { t, i18n } = useTranslation();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const fragment = entry.title || entry.text || entry.transcript || entry.ai.summary || '';

  async function handleSave() {
    if (!text.trim()) return;
    await createEntry({
      kind: 'text',
      text: text.trim(),
      importance: entry.importance,
      parentEntryId: entry.id,
    });
    void kickAiQueue();
    onDone();
  }

  if (writing) {
    return (
      <div className={styles.overlay}>
        <div className={styles.writeForm}>
          <p className={styles.quote}>{fragment}</p>
          <textarea
            className={styles.textarea}
            placeholder={t('resurface.writePlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <div className={styles.writeActions}>
            <button type="button" className={styles.cancelButton} onClick={onDone}>
              {t('common.cancel')}
            </button>
            <button type="button" className={styles.saveButton} disabled={!text.trim()} onClick={handleSave}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <span className={styles.time}>{formatRelativeTime(entry.createdAt, i18n.language)}</span>
      <button type="button" className={styles.fragment} onClick={() => setWriting(true)}>
        {fragment}
      </button>
      <button type="button" className={styles.skip} onClick={onDone}>
        {t('resurface.skip')}
      </button>
    </div>
  );
}
