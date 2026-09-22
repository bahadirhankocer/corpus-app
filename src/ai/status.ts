import { useSyncExternalStore } from 'react';

export type AiState = 'idle' | 'thinking' | 'waiting';

interface Snapshot {
  state: AiState;
  callsToday: number;
  /** the last failure of a background job, cleared by the next success */
  lastError?: string;
}

const COUNT_KEY = 'corpus.aiCalls';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCalls(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNT_KEY) ?? 'null') as { day: string; n: number } | null;
    return raw && raw.day === todayKey() ? raw.n : 0;
  } catch {
    return 0;
  }
}

let snapshot: Snapshot = { state: 'idle', callsToday: readCalls() };
const listeners = new Set<() => void>();
let queued = 0;
let waiting = false;

function emit(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

function recompute(): void {
  const state: AiState = waiting ? 'waiting' : queued > 0 ? 'thinking' : 'idle';
  if (state !== snapshot.state) emit({ ...snapshot, state });
}

export function aiJobQueued(): void {
  queued += 1;
  recompute();
}

export function aiJobDone(): void {
  queued = Math.max(0, queued - 1);
  recompute();
}

export function aiSetWaiting(value: boolean): void {
  waiting = value;
  recompute();
}

export function aiReportError(message: string | undefined): void {
  if (message !== snapshot.lastError) emit({ ...snapshot, lastError: message });
}

export function aiCallMade(): void {
  const n = readCalls() + 1;
  try {
    localStorage.setItem(COUNT_KEY, JSON.stringify({ day: todayKey(), n }));
  } catch {
    // counter is informational only
  }
  emit({ ...snapshot, callsToday: n });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiStatus(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}
