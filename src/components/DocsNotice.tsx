import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { dismissDocsStatus, useDocsStatus } from '../features/export/googleDocs';
import styles from './DocsNotice.module.css';

/** Where a Google Docs save stands, with the finished document one tap away. */
export function DocsNotice() {
  const { t } = useTranslation();
  const status = useDocsStatus();

  useEffect(() => {
    if (status.state === 'idle' || status.state === 'working') return;
    const id = window.setTimeout(dismissDocsStatus, status.state === 'done' ? 15000 : 7000);
    return () => window.clearTimeout(id);
  }, [status]);

  if (status.state === 'idle') return null;

  return (
    <div className={styles.notice} role="status">
      <span>{t(`docs.${status.state}`)}</span>
      {status.state === 'done' && (
        <a className={styles.open} href={status.url} target="_blank" rel="noreferrer" onClick={dismissDocsStatus}>
          {t('docs.open')}
        </a>
      )}
      {status.state !== 'working' && (
        <button type="button" className={styles.close} onClick={dismissDocsStatus} aria-label={t('common.close')}>
          ×
        </button>
      )}
    </div>
  );
}
