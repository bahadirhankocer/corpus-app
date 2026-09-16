import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '../../components/SegmentedControl';
import { updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';
import { kickAiQueue } from '../../ai/queue';
import styles from './AiSection.module.css';
import sectionStyles from './SettingsScreen.module.css';

interface Props {
  settings: Settings;
}

export function AiSection({ settings }: Props) {
  const { t } = useTranslation();
  const [apiKeyDraft, setApiKeyDraft] = useState<string | null>(null);

  async function handleEnabled(value: 'on' | 'off') {
    await updateSettings({ aiEnabled: value === 'on' });
    if (value === 'on') void kickAiQueue();
  }

  async function handleApiKey(value: string) {
    setApiKeyDraft(value);
    await updateSettings({ geminiApiKey: value.trim() || undefined });
    void kickAiQueue();
  }

  async function handleModel(value: string) {
    if (value.trim()) await updateSettings({ model: value.trim() });
  }

  return (
    <div className={sectionStyles.section}>
      <span className={sectionStyles.sectionTitle}>{t('settings.ai.title')}</span>

      <div className={styles.notice}>{t('settings.ai.privacyNotice')}</div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="gemini-key">
          {t('settings.ai.apiKeyLabel')}
        </label>
        <input
          id="gemini-key"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={styles.input}
          value={apiKeyDraft ?? settings.geminiApiKey ?? ''}
          onChange={(e) => handleApiKey(e.target.value)}
        />
        <span className={styles.hint}>
          {settings.geminiApiKey ? t('settings.ai.apiKeySaved') : t('settings.ai.apiKeyHint')}
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="gemini-model">
          {t('settings.ai.modelLabel')}
        </label>
        <input
          id="gemini-model"
          className={styles.input}
          defaultValue={settings.model}
          onBlur={(e) => handleModel(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.ai.enabledLabel')}</span>
        <SegmentedControl
          options={[
            { value: 'off', label: t('settings.ai.off') },
            { value: 'on', label: t('settings.ai.on') },
          ]}
          value={settings.aiEnabled ? 'on' : 'off'}
          onChange={handleEnabled}
        />
      </div>
    </div>
  );
}
