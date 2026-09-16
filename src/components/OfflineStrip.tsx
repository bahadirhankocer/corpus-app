import { useTranslation } from 'react-i18next';

import { usePendingCount } from '../db/entries';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './OfflineStrip.module.css';

export function OfflineStrip() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const pending = usePendingCount();

  if (online) return null;

  return (
    <div className={styles.strip}>
      <span>{t('offline.label')}</span>
      {typeof pending === 'number' && pending > 0 && (
        <span>· {t('offline.queued', { count: pending })}</span>
      )}
    </div>
  );
}
