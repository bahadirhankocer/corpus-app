import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '../../components/SegmentedControl';
import { updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';
import { disablePush, enablePush, pushSupported, sendTestPush, syncPush, workerUrlFor } from '../push/push';
import styles from './AudioLogSection.module.css';
import sectionStyles from './SettingsScreen.module.css';

interface Props {
  settings: Settings;
}

export function PromptsSection({ settings }: Props) {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  const { startHour, endHour } = settings.prompts;
  const { listen, questions, morning } = settings.notify;
  const supported = pushSupported();
  const hasWorker = Boolean(workerUrlFor(settings));

  async function patchPrompts(patch: Partial<Settings['prompts']>) {
    await updateSettings({ prompts: { ...settings.prompts, ...patch } });
    void syncPush();
  }

  async function patchNotify(patch: Partial<Settings['notify']>) {
    const notify = { ...settings.notify, ...patch };
    // Questions reaching the phone need at least as many questions written in the app.
    const perDay = Math.max(settings.prompts.perDay, notify.questions, 1) as Settings['prompts']['perDay'];
    await updateSettings({ notify, prompts: { ...settings.prompts, perDay } });
    void syncPush();
  }

  async function handlePush(value: 'on' | 'off') {
    setMessage(null);
    if (value === 'off') {
      await disablePush();
      return;
    }
    const result = await enablePush();
    setMessage(result === 'ok' ? null : t(`settings.prompts.push.${result}`));
  }

  async function handleTest() {
    setMessage(null);
    setMessage((await sendTestPush()) ? t('settings.prompts.testSent') : t('settings.prompts.push.error'));
  }

  return (
    <div className={sectionStyles.section}>
      <span className={sectionStyles.sectionTitle}>{t('settings.prompts.title')}</span>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.prompts.push.label')}</span>
        <SegmentedControl
          options={[
            { value: 'off', label: t('settings.ai.off') },
            { value: 'on', label: t('settings.ai.on') },
          ]}
          value={settings.pushSubscribed ? 'on' : 'off'}
          onChange={handlePush}
        />
        <span className={sectionStyles.hint}>
          {message ??
            (!supported
              ? t('settings.prompts.push.unsupported')
              : !hasWorker
                ? t('settings.prompts.push.no-worker')
                : t('settings.prompts.push.hint'))}
        </span>
        {settings.pushSubscribed && (
          <button type="button" className={sectionStyles.textButton} onClick={handleTest}>
            {t('settings.prompts.test')}
          </button>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.prompts.listen')}</span>
        <SegmentedControl
          options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
          value={listen}
          onChange={(v) => patchNotify({ listen: v })}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.prompts.questions')}</span>
        <SegmentedControl
          options={[0, 1, 2].map((n) => ({ value: n, label: String(n) }))}
          value={questions}
          onChange={(v) => patchNotify({ questions: v })}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.prompts.morning')}</span>
        <SegmentedControl
          options={[
            { value: 'off', label: t('settings.ai.off') },
            { value: 'on', label: t('settings.ai.on') },
          ]}
          value={morning ? 'on' : 'off'}
          onChange={(v) => patchNotify({ morning: v === 'on' })}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <span className={styles.label}>{t('settings.prompts.from')}</span>
          <input
            type="number"
            min={0}
            max={23}
            className={styles.input}
            defaultValue={startHour}
            onBlur={(e) => patchPrompts({ startHour: Math.min(23, Math.max(0, Number(e.target.value) || 9)) })}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{t('settings.prompts.to')}</span>
          <input
            type="number"
            min={1}
            max={24}
            className={styles.input}
            defaultValue={endHour}
            onBlur={(e) => patchPrompts({ endHour: Math.min(24, Math.max(1, Number(e.target.value) || 22)) })}
          />
        </div>
      </div>
    </div>
  );
}
