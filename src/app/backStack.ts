import { useEffect, useRef } from 'react';

/**
 * Android's back gesture walks browser history. Every screen or overlay that is open adds one history
 * step, so "back" closes the top one instead of leaving the app. Only the root screen lets it exit.
 *
 * Steps are anonymous markers, so only their count matters. Closing something from the UI does not
 * step back right away: the step is kept for a tick and reused if something else opens in the meantime.
 * Calling history.back() and pushState() together races inside the browser, so they are never mixed.
 */

interface Handler {
  id: number;
  back: () => void;
}

const stack: Handler[] = [];
let nextId = 1;
let ignoredPops = 0;
let spareSteps = 0;
let flushScheduled = false;

window.addEventListener('popstate', () => {
  if (ignoredPops > 0) {
    ignoredPops -= 1;
    return;
  }
  stack.pop()?.back();
});

function flush(): void {
  flushScheduled = false;
  if (spareSteps === 0) return;
  const steps = spareSteps;
  spareSteps = 0;
  ignoredPops += 1;
  window.history.go(-steps);
}

function push(back: () => void): () => void {
  const id = nextId++;
  stack.push({ id, back });
  if (spareSteps > 0) spareSteps -= 1;
  else window.history.pushState({ corpusBack: true }, '');

  return () => {
    const index = stack.findIndex((h) => h.id === id);
    if (index === -1) return;
    // Closed from the UI: its history step goes too, without counting as a back gesture.
    stack.splice(index, 1);
    spareSteps += 1;
    if (!flushScheduled) {
      flushScheduled = true;
      window.setTimeout(flush, 0);
    }
  };
}

/** While `active`, the back gesture calls `onBack` instead of leaving the page. */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active) return;
    return push(() => onBackRef.current());
  }, [active]);
}
