import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '../../components/SegmentedControl';
import { useSettings, updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';
import { AiSection } from './AiSection';
import { ProjectsSection } from './ProjectsSection';
import styles from './SettingsScreen.module.css';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();

  if (!settings) return null;

  async function handleLang(lang: Settings['lang']) {
    await updateSettings({ lang });
    await i18n.changeLanguage(lang);
  }

  async function handleTheme(theme: Settings['theme']) {
    await updateSettings({ theme });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t('settings.language')}</span>
        <SegmentedControl
          options={[
            { value: 'tr', label: 'Türkçe' },
            { value: 'en', label: 'English' },
          ]}
          value={settings.lang}
          onChange={handleLang}
        />
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t('settings.theme')}</span>
        <SegmentedControl
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
          value={settings.theme}
          onChange={handleTheme}
        />
      </div>

      <AiSection settings={settings} />
      <ProjectsSection settings={settings} />
    </div>
  );
}
