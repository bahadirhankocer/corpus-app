import { useAiStatus } from '../ai/status';
import styles from './Rings.module.css';

const RING_COUNT = 5;

/** Concentric hairline rings that expand and fade forever: the app's quiet repetition motif. */
export function Rings() {
  const { state } = useAiStatus();
  return (
    <svg className={styles.rings} viewBox="-100 -100 200 200" aria-hidden data-fast={state === 'thinking'}>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <circle
          key={i}
          className={styles.ring}
          r="96"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.35"
          style={{ animationDelay: `${(-i * 100) / RING_COUNT}s` }}
        />
      ))}
    </svg>
  );
}
