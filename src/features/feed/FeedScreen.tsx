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

function EntryCard({
  entry,
  number,
  onOpen,
  projects,
}: {
  entry: Entry;
  number: number;
  onOpen: () => void;
  projects: Project[] | undefined;
}) {
  const { t, i18n } = useTranslation();
  const preview = entry.title || entry.text || entry.transcript || t('feed.voicePlaceholder');
  const categories = effectiveCategories(entry);
  const projectId = effectiveProjectId(entry);
  const project = projects?.find((p) => p.id === projectId);

  const metaParts = [
    entry.kind === 'voice' ? t('feed.kindVoice') : t('feed.kindText'),
    categories.map((c) => CATEGORY_CODES[c]).join(' '),
    project?.name ?? entry.context,
    entry.ai.status === 'done' ? '' : t(`feed.aiStatus.${entry.ai.status}`),
    formatDateTime(entry.createdAt, i18n.language),
  ].filter(Boolean);

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <span className={styles.number}>{String(number).padStart(3, '0')}</span>
      <span className={styles.body}>
        <span className={styles.preview}>{preview}</span>
        <span className={styles.meta}>
          <span className={styles.metaText}>{metaParts.join(' · ')}</span>
          <span className={styles.dots}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={styles.dot} data-filled={n <= entry.importance} />
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}

export function FeedScreen({ onOpenEntry }: Props) {
  const { t } = useTranslation();
  const entries = useEntries();
  const projects = useProjects();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('nav.feed')}</h1>
        {entries && entries.length > 0 && <span className={styles.count}>{entries.length}</span>}
      </header>
      {entries && entries.length === 0 && <div className={styles.empty}>{t('feed.empty')}</div>}
      <div className={styles.list}>
        {entries?.map((entry, i) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            number={entries.length - i}
            onOpen={() => onOpenEntry(entry.id)}
            projects={projects}
          />
        ))}
      </div>
    </div>
  );
}
