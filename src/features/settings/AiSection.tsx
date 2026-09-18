import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from '../../ai/queue';
import { SegmentedControl } from '../../components/SegmentedControl';
import { updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';
import { buildSetupLink, maskKey } from '../../utils/setupLink';
import styles from './AiSection.module.css';
import sectionStyles from './SettingsScreen.module.css';

interface Props {
  settings: Settings;
}

export function AiSection({ settings }: Props) {
  const { t } = useTranslation();
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const hasKey = Boolean(settings.geminiApiKey);

  async function handleEnabled(value: 'on' | 'off') {
    await updateSettings({ aiEnabled: value === 'on' });
    if (value === 'on') void kickAiQueue();
  }

  async function handleKey(value: string) {
    setDraft(value);
    const key = value.trim();
    if (key.length < 20) return;
    await updateSettings({ geminiApiKey: key, aiEnabled: true });
    setReplacing(false);
    setDraft('');
    void kickAiQueue();
  }

  async function handleCopyLink() {
    if (!settings.geminiApiKey) return;
    await navigator.clipboard.writeText(buildSetupLink(settings.geminiApiKey, settings.pushWorkerUrl));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleModel(value: string) {
    if (value.trim()) await updateSettings({ model: value.trim() });
  }

  return (
    <div className={sectionStyles.section}>
      <span className={sectionStyles.sectionTitle}>{t('settings.ai.title')}</span>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.ai.apiKeyLabel')}</span>
        {hasKey && !replacing ? (
          <>
            <span className={styles.keyValue}>{maskKey(settings.geminiApiKey!)}</span>
            <div className={styles.actions}>
              <button type="button" className={styles.textButton} onClick={() => setReplacing(true)}>
                {t('settings.ai.change')}
              </button>
              <button type="button" className={styles.textButton} onClick={handleCopyLink}>
                {copied ? t('settings.ai.copied') : t('settings.ai.copyLink')}
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={styles.input}
              placeholder="AIza…"
              value={draft}
              onChange={(e) => handleKey(e.target.value)}
            />
            {replacing && (
              <button type="button" className={styles.textButton} onClick={() => setReplacing(false)}>
                {t('common.cancel')}
              </button>
            )}
          </>
        )}
        <span className={styles.hint}>{hasKey ? t('settings.ai.apiKeySaved') : t('settings.ai.setupHint')}</span>
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

      <div className={styles.notice}>{t('settings.ai.privacyNotice')}</div>
    </div>
  );
}
