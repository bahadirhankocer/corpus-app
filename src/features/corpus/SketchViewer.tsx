import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { writeSketch } from '../../ai/sketch';
import { useBackHandler } from '../../app/backStack';
import { saveSketch, useSketch } from '../../db/corpus';
import { ensureSettings } from '../../db/settings';
import type { DossierTheme, Lang } from '../../db/types';
import styles from './SketchViewer.module.css';

interface Props {
  theme: DossierTheme;
  lang: Lang;
  onClose: () => void;
}

/**
 * Plays the HTML sketch for an animation theme, writing it first if there is none yet. The sketch runs
 * in a sandboxed frame with scripts but no access to the app, its storage or the network origin.
 */
export function SketchViewer({ theme, lang, onClose }: Props) {
  const { t } = useTranslation();
  const sketch = useSketch(theme.key);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useBackHandler(true, onClose);

  const generate = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const settings = await ensureSettings();
      if (!settings.geminiApiKey) throw new Error('no key');
      const html = await writeSketch(theme, settings.styleGuide, settings.geminiApiKey, settings.model);
      await saveSketch(theme.key, html);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [theme]);

  useEffect(() => {
    if (sketch !== null || started.current) return;
    started.current = true;
    void generate();
  }, [sketch, generate]);

  return createPortal(
    <div className={styles.overlay}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.micro}>{t('dossier.sketch')}</span>
          <span className={styles.title}>{theme.name[lang]}</span>
        </div>
        <div className={styles.actions}>
          {sketch && (
            <button type="button" className={styles.button} disabled={busy} onClick={generate}>
              {t('dossier.regenerate')}
            </button>
          )}
          <button type="button" className={styles.button} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </header>
      <div className={styles.stage}>
        {sketch && !busy && (
          <iframe key={sketch.createdAt} className={styles.frame} sandbox="allow-scripts" srcDoc={sketch.html} title={theme.name[lang]} />
        )}
        {busy && <p className={styles.status}>{t('dossier.sketching')}</p>}
        {failed && !busy && <p className={styles.status}>{t('dossier.sketchFailed')}</p>}
      </div>
    </div>,
    document.body,
  );
}
