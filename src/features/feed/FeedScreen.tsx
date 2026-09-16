import { useTranslation } from 'react-i18next';

import { CATEGORY_CODES } from '../../constants/categories';
import { effectiveCategories, effectiveProjectId } from '../../db/effective';
import { useEntries } from '../../db/entries';
import { useProjects } from '../../db/projects';
import type { Entry, Project } from '../../db/types';
import { formatDateTime } from '../../utils/format';
import styles from './FeedScreen.module.css';

interface Props {
  onOpenEntry: (id: string) => void;
}

function EntryCard({ entry, onOpen, projects }: { entry: Entry; onOpen: () => void; projects: Project[] | undefined }) {
  const { t, i18n } = useTranslation();
  const preview = entry.title || entry.text || entry.transcript || t('feed.voicePlaceholder');
  const categories = effectiveCategories(entry);
  const projectId = effectiveProjectId(entry);
  const project = projects?.find((p) => p.id === projectId);

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <div className={styles.cardTop}>
        <span>{entry.kind === 'voice' ? t('feed.kindVoice') : t('feed.kindText')}</span>
        <span>{formatDateTime(entry.createdAt, i18n.language)}</span>
      </div>
      <div className={styles.preview}>{preview}</div>
      {categories.length > 0 && (
        <div className={styles.dots} style={{ gap: 6 }}>
          {categories.map((c) => (
            <span key={c} className={styles.aiBadge}>
              {CATEGORY_CODES[c]}
            </span>
          ))}
        </div>
      )}
      <div className={styles.cardBottom}>
        <span className={styles.context}>{project ? project.name : entry.context ?? ''}</span>
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
  const projects = useProjects();

  return (
    <div className={styles.screen}>
      {entries && entries.length === 0 && <div className={styles.empty}>{t('feed.empty')}</div>}
      {entries?.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onOpen={() => onOpenEntry(entry.id)} projects={projects} />
      ))}
    </div>
  );
}
