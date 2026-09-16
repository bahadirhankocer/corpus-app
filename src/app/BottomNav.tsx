import { useTranslation } from 'react-i18next';

import styles from './BottomNav.module.css';
import { SCREENS, type ScreenId } from './screens';

const CODES: Record<ScreenId, string> = {
  capture: 'YKL',
  feed: 'AKS',
  settings: 'AYR',
};

interface Props {
  active: ScreenId;
  onChange: (screen: ScreenId) => void;
}

export function BottomNav({ active, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <nav className={styles.nav}>
      {SCREENS.map((screen) => (
        <button
          key={screen}
          type="button"
          className={styles.item}
          data-active={screen === active}
          onClick={() => onChange(screen)}
        >
          <span className={styles.code}>{CODES[screen]}</span>
          <span>{t(`nav.${screen}`)}</span>
        </button>
      ))}
    </nav>
  );
}
