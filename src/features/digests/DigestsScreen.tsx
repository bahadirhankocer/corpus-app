import { useTranslation } from 'react-i18next';

import { useDigests } from '../../db/digests';
import { formatDateTime } from '../../utils/format';
import styles from './DigestsScreen.module.css';

export function DigestsScreen() {
  const { t, i18n } = useTranslation();
  const digests = useDigests();

  return (
    <div className={styles.screen}>
      {digests && digests.length === 0 && <div className={styles.empty}>{t('digests.empty')}</div>}
      {digests?.map((digest) => (
        <div key={digest.id} className={styles.card}>
          <span className={styles.meta}>
            {t(`digests.${digest.kind}`)} · {formatDateTime(digest.createdAt, i18n.language)}
          </span>
          <p className={styles.body}>{digest.body}</p>
        </div>
      ))}
    </div>
  );
}
