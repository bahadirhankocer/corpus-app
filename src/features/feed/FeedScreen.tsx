import { useTranslation } from 'react-i18next';

import { useEntries } from '../../db/entries';
import type { Entry } from '../../db/types';
import { formatDateTime } from '../../utils/format';
import styles from './FeedScreen.module.css';

interface Props {
  onOpenEntry: (id: string) => void;
}

function EntryCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const preview = entry.title || entry.text || entry.transcript || t('feed.voicePlaceholder');

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <div className={styles.cardTop}>
        <span>{entry.kind === 'voice' ? t('feed.kindVoice') : t('feed.kindText')}</span>
        <span>{formatDateTime(entry.createdAt, i18n.language)}</span>
      </div>
      <div className={styles.preview}>{preview}</div>
      <div className={styles.cardBottom}>
        {entry.context ? (
          <span className={styles.context}>{entry.context}</span>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.aiBadge}>{t(`feed.aiStatus.${entry.ai.status}`)}</span>
          <div className={styles.dots}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={styles.dot} data-filled={n <= entry.importance} />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

export function FeedScreen({ onOpenEntry }: Props) {
  const { t } = useTranslation();
  const entries = useEntries();

  return (
    <div className={styles.screen}>
      {entries && entries.length === 0 && <div className={styles.empty}>{t('feed.empty')}</div>}
      {entries?.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onOpen={() => onOpenEntry(entry.id)} />
      ))}
    </div>
  );
}
