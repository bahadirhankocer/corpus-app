import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { stamp } from '../../ai/context';
import { useBackHandler } from '../../app/backStack';
import { db } from '../../db/db';
import type { CorpusBridge, Lang } from '../../db/types';
import { entryView } from '../../i18n/localize';
import styles from './BridgeSheet.module.css';

interface Props {
  bridge: CorpusBridge;
  lang: Lang;
  onClose: () => void;
  onOpenEntry: (id: string) => void;
}

const EXIT_MS = 220;

/** Why the AI connected this: its reasoning and the entries it came from. */
export function BridgeSheet({ bridge, lang, onClose, onOpenEntry }: Props) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const entries = useLiveQuery(
    async () => (await db.entries.bulkGet(bridge.entryIds)).filter((e) => e !== undefined),
    [bridge.id],
  );

  function close() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, EXIT_MS);
  }

  useBackHandler(!closing, close);

  return createPortal(
    <div className={styles.scrim} data-closing={closing} onClick={close}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <span className={styles.micro}>{t('corpus.bridge')}</span>
        <h3 className={styles.term}>{bridge.term[lang]}</h3>
        <p className={styles.why}>{bridge.why[lang]}</p>
        {entries && entries.length > 0 && (
          <ul className={styles.sources}>
            {entries.map((entry) => {
              const view = entryView(entry, lang);
              return (
                <li key={entry.id}>
                  <button type="button" className={styles.source} onClick={() => onOpenEntry(entry.id)}>
                    <span className={styles.micro}>{stamp(entry.createdAt, lang)}</span>
                    <span className={styles.quote}>{view.title || view.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
