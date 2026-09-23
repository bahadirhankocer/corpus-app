import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshMap } from '../../ai/corpusJob';
import { useAllLinks } from '../../db/links';
import { useEntries } from '../../db/entries';
import { useLatestMap } from '../../db/maps';
import { useProjects } from '../../db/projects';
import { useSettings } from '../../db/settings';
import { asLang } from '../../i18n/localize';
import { Constellation } from './Constellation';
import styles from './MapScreen.module.css';
import { SequenceMapView } from './SequenceMapView';

interface Props {
  onOpenEntry: (id: string) => void;
}

/** The corpus from further away: numbered sequences on a matrix, drawn by the model. */
export function MapScreen({ onOpenEntry }: Props) {
  const { t, i18n } = useTranslation();
  const lang = asLang(i18n.language);
  const entries = useEntries();
  const links = useAllLinks();
  const projects = useProjects();
  const settings = useSettings();
  const map = useLatestMap();
  const [drawing, setDrawing] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const done = useMemo(() => (entries ?? []).filter((e) => e.ai.status === 'done'), [entries]);
  const aiReady = Boolean(settings?.aiEnabled && settings.geminiApiKey);

  async function redraw() {
    setDrawing(true);
    try {
      await refreshMap({ force: true });
    } finally {
      setDrawing(false);
    }
  }

  // The first map is drawn as soon as there is something to draw.
  useEffect(() => {
    if (map === null && aiReady && done.length > 0) void refreshMap();
  }, [map, aiReady, done.length]);

  return (
    <div className={styles.screen}>
      <div className={styles.canvas}>
        {done.length === 0 ? (
          <p className={styles.empty}>{t('map.empty')}</p>
        ) : map ? (
          <SequenceMapView
            map={map}
            entries={done}
            links={links ?? []}
            lang={lang}
            freshLabel={t('map.fresh')}
            onOpenEntry={onOpenEntry}
            fitSignal={fitSignal}
          />
        ) : (
          <Constellation entries={done} links={links ?? []} projects={projects ?? []} onOpenEntry={onOpenEntry} />
        )}
      </div>
      {done.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.caption}>
            {map
              ? t('map.captionSequences', { sequences: map.clusters.length, entries: done.length })
              : aiReady
                ? t('map.drawing')
                : t('map.caption', { entries: done.length, links: links?.length ?? 0 })}
          </span>
          {map && (
            <span className={styles.actions}>
              <button type="button" className={styles.action} onClick={() => setFitSignal((n) => n + 1)}>
                {t('map.fit')}
              </button>
              <button type="button" className={styles.action} disabled={drawing || !aiReady} onClick={() => void redraw()}>
                {drawing ? t('map.drawing') : t('map.redraw')}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
