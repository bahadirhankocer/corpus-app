import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '../../components/SegmentedControl';
import { updateSettings } from '../../db/settings';
import type { Settings } from '../../db/types';
import { disablePush, enablePush, pushSupported, syncPush, workerUrlFor } from '../push/push';
import styles from './AudioLogSection.module.css';
import sectionStyles from './SettingsScreen.module.css';

interface Props {
  settings: Settings;
}

export function PromptsSection({ settings }: Props) {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  const { perDay, startHour, endHour } = settings.prompts;
  const supported = pushSupported();
  const hasWorker = Boolean(workerUrlFor(settings));

  async function patchPrompts(patch: Partial<Settings['prompts']>) {
    await updateSettings({ prompts: { ...settings.prompts, ...patch } });
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

  return (
    <div className={sectionStyles.section}>
      <span className={sectionStyles.sectionTitle}>{t('settings.prompts.title')}</span>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.prompts.perDay')}</span>
        <SegmentedControl
          options={[
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          value={perDay}
          onChange={(v) => patchPrompts({ perDay: v as Settings['prompts']['perDay'] })}
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
      </div>
    </div>
  );
}
