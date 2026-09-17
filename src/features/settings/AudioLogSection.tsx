import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '../../components/SegmentedControl';
import { updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';
import styles from './AudioLogSection.module.css';
import sectionStyles from './SettingsScreen.module.css';

interface Props {
  settings: Settings;
}

export function AudioLogSection({ settings }: Props) {
  const { t } = useTranslation();

  function handleStyleGuide(value: string) {
    void updateSettings({ styleGuide: value });
  }

  function handleField<K extends keyof Settings['audioLog']>(key: K, value: Settings['audioLog'][K]) {
    void updateSettings({ audioLog: { ...settings.audioLog, [key]: value } });
  }

  return (
    <>
      <div className={sectionStyles.section}>
        <span className={sectionStyles.sectionTitle}>{t('settings.styleGuide')}</span>
        <textarea
          className={styles.textarea}
          defaultValue={settings.styleGuide}
          onBlur={(e) => handleStyleGuide(e.target.value)}
        />
      </div>

      <div className={sectionStyles.section}>
        <span className={sectionStyles.sectionTitle}>{t('settings.audioLogTitle')}</span>

        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.label}>{t('settings.audioLogNextNumber')}</span>
            <input
              type="number"
              className={styles.input}
              defaultValue={settings.audioLog.nextNumber}
              onBlur={(e) => handleField('nextNumber', Number(e.target.value) || 1)}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>{t('settings.audioLogTargetMinutes')}</span>
            <input
              type="number"
              className={styles.input}
              defaultValue={settings.audioLog.targetMinutes}
              onBlur={(e) => handleField('targetMinutes', Number(e.target.value) || 1)}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>{t('settings.audioLogWpm')}</span>
            <input
              type="number"
              className={styles.input}
              defaultValue={settings.audioLog.wordsPerMinute}
              onBlur={(e) => handleField('wordsPerMinute', Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t('settings.audioLogLang')}</span>
          <SegmentedControl
            options={[
              { value: 'tr', label: 'Türkçe' },
              { value: 'en', label: 'English' },
            ]}
            value={settings.audioLog.lang}
            onChange={(v) => handleField('lang', v)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t('settings.audioLogCues')}</span>
          <SegmentedControl
            options={[
              { value: 'off', label: t('settings.ai.off') },
              { value: 'on', label: t('settings.ai.on') },
            ]}
            value={settings.audioLog.cues ? 'on' : 'off'}
            onChange={(v) => handleField('cues', v === 'on')}
          />
        </div>
      </div>
    </>
  );
}
