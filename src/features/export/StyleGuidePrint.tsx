import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { ALL_CATEGORIES } from '../../constants/categories';
import { effectiveCategories } from '../../db/effective';
import { useLinksForEntries } from '../../db/links';
import type { Category, Entry, Project, Sequence } from '../../db/types';
import { formatDateTime } from '../../utils/format';
import styles from './StyleGuidePrint.module.css';

interface Props {
  project: Project;
  entries: Entry[];
  sequence: Sequence | undefined;
  onClose: () => void;
}

function entryPreview(entry: Entry): string {
  return entry.title || entry.text || entry.transcript || entry.ai.summary || '';
}

export function StyleGuidePrint({ project, entries, sequence, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const entryIds = entries.map((e) => e.id);
  const links = useLinksForEntries(entryIds);
  const entryMap = new Map(entries.map((e) => [e.id, e]));

  const accepted = (links ?? []).filter((l) => l.kind === 'connection' && l.state === 'accepted');
  const contradictions = (links ?? []).filter((l) => l.kind === 'contradiction' && l.state !== 'dismissed');

  const groups = ALL_CATEGORIES.map((cat: Category) => ({
    category: cat,
    entries: entries.filter((e) => effectiveCategories(e).includes(cat)),
  })).filter((g) => g.entries.length > 0);

  function handlePrint() {
    window.print();
  }

  const content = (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <button type="button" className={styles.barButton} onClick={onClose}>
          {t('common.back')}
        </button>
        <button type="button" className={styles.barButton} onClick={handlePrint}>
          {t('export.print')}
        </button>
      </div>
      <div className={styles.page}>
        <h1 className={styles.title}>{project.name}</h1>
        <p className={styles.date}>{formatDateTime(new Date().toISOString(), i18n.language)}</p>

        {groups.map((g) => (
          <div key={g.category} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t(`category.${g.category}`)}</h2>
            {g.entries.map((e) => (
              <p key={e.id} className={styles.line}>
                {entryPreview(e)}
              </p>
            ))}
          </div>
        ))}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('export.sequence')}</h2>
          {sequence && sequence.sections.length > 0 ? (
            sequence.sections.map((s) => (
              <div key={s.id} className={styles.sequenceSection}>
                <p className={styles.sequenceSectionTitle}>{s.label}</p>
                {s.entryIds.map((id) => {
                  const e = entryMap.get(id);
                  return e ? (
                    <p key={id} className={styles.line}>
                      {entryPreview(e)}
                    </p>
                  ) : null;
                })}
              </div>
            ))
          ) : (
            <p className={styles.empty}>{t('export.noSequence')}</p>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('export.acceptedLinks')}</h2>
          {accepted.length > 0 ? (
            accepted.map((l) => (
              <p key={l.id} className={styles.line}>
                {entryPreview(entryMap.get(l.fromId)!)} — {entryPreview(entryMap.get(l.toId)!)}: {l.rationale}
              </p>
            ))
          ) : (
            <p className={styles.empty}>{t('export.none')}</p>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('export.openContradictions')}</h2>
          {contradictions.length > 0 ? (
            contradictions.map((l) => (
              <p key={l.id} className={styles.line}>
                {entryPreview(entryMap.get(l.fromId)!)} — {entryPreview(entryMap.get(l.toId)!)}: {l.rationale}
              </p>
            ))
          ) : (
            <p className={styles.empty}>{t('export.none')}</p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
