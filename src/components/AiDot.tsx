import { useTranslation } from 'react-i18next';

import { useAiStatus } from '../ai/status';
import styles from './AiDot.module.css';

interface Props {
  onClick?: () => void;
}

/** The AI's presence: it breathes when idle, quickens while it thinks and dims while it waits for quota. */
export function AiDot({ onClick }: Props) {
  const { t } = useTranslation();
  const { state } = useAiStatus();
  const label = t(`atelier.state.${state}`);

  const dot = (
    <span className={styles.dot} data-state={state}>
      <span className={styles.core} />
      <span className={styles.halo} />
    </span>
  );

  if (!onClick) return dot;
  return (
    <button type="button" className={styles.button} onClick={onClick} aria-label={label}>
      {dot}
    </button>
  );
}
