import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './Layer.module.css';

interface Props {
  code: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const EXIT_MS = 240;

/** A full-screen layer that opens from the Atelier and slides away when closed. */
export function Layer({ code, title, onClose, children }: Props) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, EXIT_MS);
  }

  return (
    <div className={styles.layer} data-closing={closing}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.code}>{code}</span>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <button type="button" className={styles.close} onClick={handleClose}>
          {t('common.close')}
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
