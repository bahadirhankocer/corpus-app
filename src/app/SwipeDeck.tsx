import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

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

export function SwipeDeck({ active, onChange, panels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollingToRef = useRef<ScreenId | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frame = 0;
    function handleScroll() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!el) return;
        const index = Math.round(el.scrollLeft / el.clientWidth);
        const next = SCREENS[index];
        if (!next) return;
        if (scrollingToRef.current && scrollingToRef.current !== next) return;
        scrollingToRef.current = null;
        onChange(next);
      });
    }
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [onChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const index = SCREENS.indexOf(active);
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 4) {
      scrollingToRef.current = active;
      el.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, [active]);

  return (
    <div className={styles.deck} ref={containerRef}>
      {panels.map((panel) => (
        <div className={styles.panel} key={panel.id}>
          {panel.node}
        </div>
      ))}
    </div>
  );
}
