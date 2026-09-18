import { useTranslation } from 'react-i18next';

import { CHANGELOG } from '../../changelog';
import styles from './VersionsScreen.module.css';

export function VersionsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'tr';

  return (
    <div className={styles.screen}>
      <p className={styles.current}>
        <span className={styles.micro}>{t('versions.current')}</span>
        <span className={styles.number}>v{__APP_VERSION__}</span>
        <span className={styles.micro}>
          {t('versions.built')} {__BUILD_DATE__}
        </span>
      </p>

      {CHANGELOG.map((release) => (
        <article key={release.version} className={styles.release}>
          <header className={styles.releaseHeader}>
            <span className={styles.version}>v{release.version}</span>
            <span className={styles.micro}>{release.date}</span>
          </header>
          <h2 className={styles.releaseTitle}>{release.title[lang]}</h2>
          <ul className={styles.items}>
            {release.items.map((item, i) => (
              <li key={i} className={styles.item}>
                {item[lang]}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
