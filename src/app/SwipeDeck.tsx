import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { ScreenId } from './screens';
import { SCREENS } from './screens';
import styles from './SwipeDeck.module.css';

interface Panel {
  id: ScreenId;
  node: ReactNode;
}

interface Props {
  active: ScreenId;
  onChange: (screen: ScreenId) => void;
  panels: Panel[];
}

const SETTLE_FALLBACK_MS = 140;

export function SwipeDeck({ active, onChange, panels }: Props) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const settledIndexRef = useRef(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // React only hears about a new screen once the deck has come to rest. Reporting every
  // intermediate index re-rendered the whole app mid-animation and made the snap stutter.
  useEffect(() => {
    const el = deckRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;

    let frame = 0;
    let timer = 0;

    function settle() {
      if (!el) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      settledIndexRef.current = index;
      const next = SCREENS[index];
      if (next) onChangeRef.current(next);
    }

    function handleScroll() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (el && wrap) wrap.style.setProperty('--deck-p', String(el.scrollLeft / el.clientWidth));
      });
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_FALLBACK_MS);
    }

    function handleScrollEnd() {
      window.clearTimeout(timer);
      settle();
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('scrollend', handleScrollEnd);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('scrollend', handleScrollEnd);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const index = SCREENS.indexOf(active);
    if (index === settledIndexRef.current) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }, [active]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.deck} ref={deckRef}>
        {panels.map((panel) => (
          <div className={styles.panel} key={panel.id}>
            {panel.node}
          </div>
        ))}
      </div>

      <nav className={styles.indicator} aria-label="screens">
        <div className={styles.track}>
          {SCREENS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.tick}
              aria-label={t(`nav.${id}`)}
              aria-current={id === active}
              onClick={() => onChangeRef.current(id)}
            />
          ))}
          <span className={styles.thumb} />
        </div>
        <span className={styles.label}>{t(`nav.${active}`)}</span>
      </nav>
    </div>
  );
}
