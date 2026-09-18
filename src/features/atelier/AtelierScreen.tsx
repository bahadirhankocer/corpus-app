import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAiStatus } from '../../ai/status';
import type { LayerId } from '../../app/screens';
import { AiDot } from '../../components/AiDot';
import { useAllLinks } from '../../db/links';
import { effectiveProjectId } from '../../db/effective';
import { useEntries } from '../../db/entries';
import { useProjects } from '../../db/projects';
import { useQuestions } from '../../db/questions';
import { useSettings } from '../../db/settings';
import { useThoughts } from '../../db/thoughts';
import { formatRelativeTime } from '../../utils/relativeTime';
import styles from './AtelierScreen.module.css';
import { Constellation } from './Constellation';

interface Props {
  onOpenEntry: (id: string) => void;
  onOpenLayer: (id: LayerId) => void;
  onOpenQuestion: () => void;
  onStartInterview: (projectId: string) => void;
}

const INDEX: LayerId[] = ['map', 'sequence', 'digests', 'audiolog', 'settings', 'versions'];

export function AtelierScreen({ onOpenEntry, onOpenLayer, onOpenQuestion, onStartInterview }: Props) {
  const { t, i18n } = useTranslation();
  const { state, callsToday } = useAiStatus();
  const settings = useSettings();
  const entries = useEntries();
  const links = useAllLinks();
  const projects = useProjects();
  const questions = useQuestions();
  const thoughts = useThoughts(8);
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null);

  // useEntries is newest first, so `done.find` above yields the latest entry of a project.
  const done = useMemo(() => (entries ?? []).filter((e) => e.ai.status === 'done'), [entries]);
  const activeProjects = useMemo(() => {
    const lastActivity = (id: string) => done.find((e) => effectiveProjectId(e) === id)?.createdAt ?? '';
    return (projects ?? [])
      .filter((p) => p.status === 'active')
      .sort((a, b) => lastActivity(b.id).localeCompare(lastActivity(a.id)));
  }, [projects, done]);
  const project = activeProjects.find((p) => p.id === chosenProjectId) ?? activeProjects[0];
  const waiting = questions?.length ?? 0;
  const aiReady = Boolean(settings?.aiEnabled && settings.geminiApiKey);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.kicker}>{t('nav.atelier')}</span>
          <span className={styles.status}>
            {aiReady ? t(`atelier.state.${state}`) : t('atelier.noKey')}
            {aiReady && callsToday > 0 && <span className={styles.calls}> · {t('atelier.calls', { count: callsToday })}</span>}
          </span>
        </div>
        <AiDot />
      </header>

      <div className={styles.canvas}>
        {done.length === 0 ? (
          <p className={styles.empty}>{t('atelier.empty')}</p>
        ) : (
          <Constellation entries={done} links={links ?? []} projects={projects ?? []} onOpenEntry={onOpenEntry} />
        )}
      </div>

      {waiting > 0 && (
        <button type="button" className={styles.question} onClick={onOpenQuestion}>
          {t('question.waiting', { count: waiting })}
        </button>
      )}

      {activeProjects.length > 0 && (
        <section className={styles.section}>
          <div className={styles.chips}>
            {activeProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.chip}
                data-active={p.id === project?.id}
                onClick={() => setChosenProjectId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {project && (
            <div className={styles.compendium}>
              {project.compendium ? (
                <p className={styles.compendiumText}>{project.compendium}</p>
              ) : (
                <p className={styles.muted}>{t('atelier.noCompendium')}</p>
              )}
              {!project.manifesto && aiReady && (
                <button type="button" className={styles.textButton} onClick={() => onStartInterview(project.id)}>
                  {t('atelier.startInterview')}
                </button>
              )}
              {project.manifesto && (
                <p className={styles.manifesto}>
                  <span className={styles.micro}>{t('atelier.manifesto')}</span>
                  {project.manifesto}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className={styles.section}>
        <span className={styles.micro}>{t('atelier.thoughts')}</span>
        {thoughts && thoughts.length === 0 && <p className={styles.muted}>{t('atelier.noThoughts')}</p>}
        <ul className={styles.thoughts}>
          {thoughts?.map((th, i) => (
            <li key={th.id} className={styles.thought} style={{ opacity: Math.max(0.45, 1 - i * 0.08) }}>
              <button
                type="button"
                className={styles.thoughtButton}
                disabled={th.entryIds.length === 0}
                onClick={() => th.entryIds[0] && onOpenEntry(th.entryIds[0])}
              >
                <span className={styles.thoughtMeta}>
                  {t(`atelier.kind.${th.kind}`)} · {formatRelativeTime(th.createdAt, i18n.language)}
                </span>
                <span className={styles.thoughtText}>{th.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <nav className={styles.index}>
        {INDEX.map((id, i) => (
          <button key={id} type="button" className={styles.indexItem} onClick={() => onOpenLayer(id)}>
            <span className={styles.indexNumber}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.indexName}>{t(`layer.${id}`)}</span>
          </button>
        ))}
      </nav>

      <footer className={styles.footer}>
        v{__APP_VERSION__} · {__BUILD_DATE__}
      </footer>
    </div>
  );
}
