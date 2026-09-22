import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parseBridges } from '../../ai/corpus';
import { refreshCorpus } from '../../ai/corpusJob';
import { useAiStatus } from '../../ai/status';
import type { LayerId } from '../../app/screens';
import { AiDot } from '../../components/AiDot';
import { useCorpusVersions } from '../../db/corpus';
import { useEntries } from '../../db/entries';
import { useQuestions } from '../../db/questions';
import { useSettings } from '../../db/settings';
import type { CorpusBridge, CorpusDoc, Lang } from '../../db/types';
import { asLang } from '../../i18n/localize';
import { formatRelativeTime } from '../../utils/relativeTime';
import { BridgeSheet } from './BridgeSheet';
import styles from './CorpusScreen.module.css';
import { DossierView } from './DossierView';

interface Props {
  onOpenEntry: (id: string) => void;
  onOpenLayer: (id: LayerId) => void;
  onOpenQuestion: () => void;
  onCapture: () => void;
}

const INDEX: LayerId[] = ['audiolog', 'settings', 'versions'];

function Paragraphs({
  text,
  bridges,
  className,
  onBridge,
}: {
  text: string;
  bridges: Map<string, CorpusBridge>;
  className: string;
  onBridge: (bridge: CorpusBridge) => void;
}) {
  const known = useMemo(() => new Set(bridges.keys()), [bridges]);
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((paragraph, i) => (
          <p key={i} className={className}>
            {parseBridges(paragraph.trim(), known).map((segment, j) =>
              segment.bridgeId ? (
                <button key={j} type="button" className={styles.bridge} onClick={() => onBridge(bridges.get(segment.bridgeId!)!)}>
                  {segment.text}
                </button>
              ) : (
                <Fragment key={j}>{segment.text}</Fragment>
              ),
            )}
          </p>
        ))}
    </>
  );
}

function CorpusText({ doc, lang, onBridge }: { doc: CorpusDoc; lang: Lang; onBridge: (b: CorpusBridge) => void }) {
  const bridges = useMemo(() => new Map(doc.bridges.map((b) => [b.id, b])), [doc]);
  return (
    <article className={styles.article} key={doc.id}>
      <h1 className={styles.title}>{doc.title[lang]}</h1>
      <Paragraphs text={doc.core[lang]} bridges={bridges} className={styles.core} onBridge={onBridge} />
      {doc.sections.map((section, i) => (
        <section key={i} className={styles.section}>
          <h2 className={styles.heading}>
            <span className={styles.headingNumber}>{String(i + 1).padStart(2, '0')}</span>
            {section.heading[lang]}
          </h2>
          <Paragraphs text={section.body[lang]} bridges={bridges} className={styles.body} onBridge={onBridge} />
        </section>
      ))}
      <p className={styles.direction}>{doc.direction[lang]}</p>
    </article>
  );
}

export function CorpusScreen({ onOpenEntry, onOpenLayer, onOpenQuestion, onCapture }: Props) {
  const { t, i18n } = useTranslation();
  const lang = asLang(i18n.language);
  const { state, lastError } = useAiStatus();
  const [requested, setRequested] = useState(false);
  const settings = useSettings();
  const versions = useCorpusVersions();
  const entries = useEntries();
  const questions = useQuestions(lang);
  const [versionIndex, setVersionIndex] = useState(0);
  const [bridge, setBridge] = useState<CorpusBridge | null>(null);

  const doc = versions?.[Math.min(versionIndex, (versions?.length ?? 1) - 1)];
  const aiReady = Boolean(settings?.aiEnabled && settings.geminiApiKey);
  const waiting = questions?.length ?? 0;
  const hasEntries = (entries?.length ?? 0) > 0;
  const processed = entries?.filter((e) => e.ai.status === 'done').length ?? 0;
  const failed = entries?.filter((e) => e.ai.status === 'error').length ?? 0;
  const errorText = lastError
    ? t(`corpus.error.${['quota-day', 'quota-minute', 'offline', 'key', 'timeout'].includes(lastError) ? lastError : 'other'}`, { detail: lastError })
    : null;

  function writeNow() {
    setRequested(true);
    void refreshCorpus({ force: true }).finally(() => setRequested(false));
  }
  const total = versions?.length ?? 0;

  return (
    <div className={styles.screen}>
      <div className={styles.scroll}>
        <header className={styles.meta}>
          <AiDot />
          <span className={styles.micro}>
            {t('corpus.name')}
            {doc && (
              <>
                {' · '}v{total - versionIndex} · {formatRelativeTime(doc.createdAt, i18n.language)}
              </>
            )}
            {state === 'thinking' && <> · {t('corpus.thinking')}</>}
          </span>
          {total > 1 && (
            <span className={styles.stepper}>
              <button
                type="button"
                className={styles.step}
                disabled={versionIndex >= total - 1}
                onClick={() => setVersionIndex((i) => i + 1)}
                aria-label={t('corpus.older')}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.step}
                disabled={versionIndex === 0}
                onClick={() => setVersionIndex((i) => i - 1)}
                aria-label={t('corpus.newer')}
              >
                ›
              </button>
            </span>
          )}
        </header>

        {waiting > 0 && (
          <button type="button" className={styles.question} onClick={onOpenQuestion}>
            {t('question.waiting', { count: waiting })}
          </button>
        )}

        {doc ? (
          <CorpusText doc={doc} lang={lang} onBridge={setBridge} />
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {!aiReady ? t('corpus.noKey') : hasEntries ? t('corpus.writing') : t('corpus.empty')}
            </p>
            {aiReady && hasEntries && (
              <p className={styles.micro}>
                {t('corpus.progress', { done: processed, total: entries?.length ?? 0 })}
                {failed > 0 && <> · {t('corpus.failed', { count: failed })}</>}
                {' · '}
                {t(`aiState.${state}`)}
              </p>
            )}
            {errorText && <p className={styles.errorText}>{errorText}</p>}
            {aiReady && hasEntries && (
              <button type="button" className={styles.textButton} disabled={requested} onClick={writeNow}>
                {requested ? t('corpus.thinking') : t('corpus.writeNow')}
              </button>
            )}
          </div>
        )}

        {doc && errorText && <p className={styles.errorText}>{errorText}</p>}

        {doc && versionIndex === 0 && (
          <button type="button" className={styles.rewrite} disabled={requested} onClick={writeNow}>
            {requested ? t('corpus.thinking') : t('corpus.rewrite')}
          </button>
        )}

        {doc && <DossierView lang={lang} onOpenEntry={onOpenEntry} onOpenLayer={onOpenLayer} />}

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

      <div className={styles.ringBar}>
        <button type="button" className={styles.ring} onClick={onCapture} aria-label={t('corpus.capture')}>
          <span className={styles.ringInner} />
        </button>
      </div>

      {bridge && <BridgeSheet bridge={bridge} lang={lang} onClose={() => setBridge(null)} onOpenEntry={onOpenEntry} />}
    </div>
  );
}
