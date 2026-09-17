import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AudioLog } from '../../db/types';
import styles from './ReadingMode.module.css';

interface Props {
  audioLog: AudioLog;
  onClose: () => void;
}

const DEFAULT_SPEED = 18; // px/sec

export function ReadingMode({ audioLog, onClose }: Props) {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function acquire() {
      try {
        wakeLockRef.current = await navigator.wakeLock?.request('screen');
      } catch {
        // not supported or denied; reading mode still works, screen may sleep
      }
    }
    void acquire();

    function handleVisibility() {
      if (document.visibilityState === 'visible') void acquire();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();

    function tick(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollerRef.current;
      if (el) el.scrollTop += speed * dt;
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, speed]);

  return (
    <div className={styles.overlay}>
      <div className={styles.topBar} data-hidden={playing}>
        <button type="button" className={styles.barButton} onClick={onClose}>
          {t('common.back')}
        </button>
        <div style={{ display: 'flex', gap: 16 }}>
          <button type="button" className={styles.barButton} onClick={() => setSpeed((s) => Math.max(6, s - 4))}>
            −
          </button>
          <button type="button" className={styles.barButton} onClick={() => setSpeed((s) => Math.min(60, s + 4))}>
            +
          </button>
        </div>
      </div>
      <div className={styles.scroller} ref={scrollerRef} onClick={() => setPlaying((p) => !p)}>
        <div className={styles.text}>
          {audioLog.paragraphs.map((p, i) => (
            <p key={i} className={styles.paragraph}>
              {p.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
