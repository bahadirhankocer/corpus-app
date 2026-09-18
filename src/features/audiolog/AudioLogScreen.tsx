import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAudioLogs } from '../../db/audiologs';
import { useSettings } from '../../db/settings';
import { formatDateTime } from '../../utils/format';
import { AudioLogEditor } from './AudioLogEditor';
import styles from './AudioLogScreen.module.css';
import { generateWeeklyAudioLog } from './generateAudioLog';

export function AudioLogScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const audioLogs = useAudioLogs();
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function handleGenerate() {
    if (!settings) return;
    setGenerating(true);
    try {
      const log = await generateWeeklyAudioLog(settings);
      if (log) setOpenId(log.id);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.generateButton}
          disabled={generating || !settings?.geminiApiKey}
          onClick={handleGenerate}
        >
          {generating ? t('sequence.generating') : t('audiolog.generate')}
        </button>
      </div>

      {audioLogs && audioLogs.length === 0 && <div className={styles.empty}>{t('audiolog.empty')}</div>}

      <div className={styles.list}>
        {audioLogs?.map((log) => (
          <button key={log.id} type="button" className={styles.item} onClick={() => setOpenId(log.id)}>
            <span className={styles.itemTitle}>
              AUDIO LOG {String(log.number).padStart(3, '0')} — {log.title}
            </span>
            <span className={styles.itemMeta}>
              {t(`audiolog.status.${log.status}`)} · {formatDateTime(log.createdAt, i18n.language)}
            </span>
          </button>
        ))}
      </div>

      {openId && <AudioLogEditor audioLogId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
