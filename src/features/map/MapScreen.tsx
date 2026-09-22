import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAllLinks } from '../../db/links';
import { useEntries } from '../../db/entries';
import { useProjects } from '../../db/projects';
import { Constellation } from './Constellation';
import styles from './MapScreen.module.css';

interface Props {
  onOpenEntry: (id: string) => void;
}

/** A quiet page: the whole corpus as a living constellation. Nothing to do here but look. */
export function MapScreen({ onOpenEntry }: Props) {
  const { t } = useTranslation();
  const entries = useEntries();
  const links = useAllLinks();
  const projects = useProjects();
  const done = useMemo(() => (entries ?? []).filter((e) => e.ai.status === 'done'), [entries]);

  return (
    <div className={styles.screen}>
      <div className={styles.canvas}>
        {done.length === 0 ? (
          <p className={styles.empty}>{t('map.empty')}</p>
        ) : (
          <Constellation entries={done} links={links ?? []} projects={projects ?? []} onOpenEntry={onOpenEntry} />
        )}
      </div>
      {done.length > 0 && (
        <p className={styles.caption}>{t('map.caption', { entries: done.length, links: links?.length ?? 0 })}</p>
      )}
    </div>
  );
}
