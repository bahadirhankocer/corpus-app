import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshDossier } from '../../ai/corpusJob';
import type { LayerId } from '../../app/screens';
import { useDossier } from '../../db/corpus';
import type { DossierTheme, Lang } from '../../db/types';
import styles from './CorpusScreen.module.css';
import { SketchViewer } from './SketchViewer';

interface Props {
  lang: Lang;
  onOpenEntry: (id: string) => void;
  onOpenLayer: (id: LayerId) => void;
}

type Part = 'candidate' | 'brief' | 'scenario' | 'themes' | 'side';

const TOOLS: LayerId[] = ['sequence', 'links', 'digests'];

function Fold({ id, open, onToggle, title, children }: { id: Part; open: boolean; onToggle: (id: Part) => void; title: string; children: ReactNode }) {
  return (
    <div className={styles.fold} data-open={open}>
      <button type="button" className={styles.foldHead} onClick={() => onToggle(id)} aria-expanded={open}>
        <span className={styles.foldTitle}>{title}</span>
        <span className={styles.foldMark} aria-hidden />
      </button>
      {open && <div className={styles.foldBody}>{children}</div>}
    </div>
  );
}

/** The production file the corpus is leading to: candidate, brief, scenario, animation themes, side ideas. */
export function DossierView({ lang, onOpenEntry, onOpenLayer }: Props) {
  const { t } = useTranslation();
  const dossier = useDossier();
  const [open, setOpen] = useState<Part | null>(null);
  const [sketch, setSketch] = useState<DossierTheme | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const toggle = (id: Part) => setOpen((current) => (current === id ? null : id));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshDossier();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className={styles.dossier}>
      <div className={styles.dossierHead}>
        <span className={styles.micro}>{t('dossier.title')}</span>
        {dossier && (
          <button type="button" className={styles.microButton} disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? t('corpus.thinking') : t('dossier.refresh')}
          </button>
        )}
      </div>

      {!dossier && <p className={styles.muted}>{t('dossier.empty')}</p>}

      {dossier && (
        <>
          <Fold id="candidate" open={open === 'candidate'} onToggle={toggle} title={t('dossier.candidate')}>
            <p className={styles.candidateTitle}>{dossier.candidate.title[lang]}</p>
            <p className={styles.body}>{dossier.candidate.logline[lang]}</p>
            <p className={`${styles.body} ${styles.pre}`}>{dossier.candidate.structure[lang]}</p>
          </Fold>
          <Fold id="brief" open={open === 'brief'} onToggle={toggle} title={t('dossier.brief')}>
            <p className={`${styles.body} ${styles.pre}`}>{dossier.brief[lang]}</p>
          </Fold>
          <Fold id="scenario" open={open === 'scenario'} onToggle={toggle} title={t('dossier.scenario')}>
            <p className={`${styles.body} ${styles.pre}`}>{dossier.scenario[lang]}</p>
          </Fold>
          <Fold id="themes" open={open === 'themes'} onToggle={toggle} title={t('dossier.themes')}>
            {dossier.themes.map((theme) => (
              <div key={theme.key} className={styles.theme}>
                <p className={styles.themeName}>{theme.name[lang]}</p>
                <p className={styles.body}>{theme.description[lang]}</p>
                <div className={styles.themeActions}>
                  <button type="button" className={styles.microButton} onClick={() => setSketch(theme)}>
                    {t('dossier.sketch')}
                  </button>
                  {theme.entryIds[0] && (
                    <button type="button" className={styles.microButton} onClick={() => onOpenEntry(theme.entryIds[0])}>
                      {t('dossier.source')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </Fold>
          <Fold id="side" open={open === 'side'} onToggle={toggle} title={t('dossier.side')}>
            {dossier.sideIdeas.map((idea, i) => (
              <p key={i} className={styles.body}>
                {idea.text[lang]}
              </p>
            ))}
          </Fold>
        </>
      )}

      <div className={styles.tools}>
        {TOOLS.map((id) => (
          <button key={id} type="button" className={styles.microButton} onClick={() => onOpenLayer(id)}>
            {t(`layer.${id}`)}
          </button>
        ))}
      </div>

      {sketch && <SketchViewer theme={sketch} lang={lang} onClose={() => setSketch(null)} />}
    </section>
  );
}
