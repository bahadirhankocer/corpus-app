import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { AudioLog } from './types';

export async function createAudioLog(input: Omit<AudioLog, 'id' | 'createdAt' | 'status'>): Promise<AudioLog> {
  const audioLog: AudioLog = {
    ...input,
    id: uuid(),
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  await db.audioLogs.add(audioLog);
  return audioLog;
}

export async function updateAudioLog(id: string, patch: Partial<AudioLog>): Promise<void> {
  await db.audioLogs.update(id, patch);
}

export async function setAudioLogStatus(id: string, status: AudioLog['status']): Promise<void> {
  await db.audioLogs.update(id, { status });
}

export function useAudioLogs(): AudioLog[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.audioLogs.toArray();
    return all.sort((a, b) => b.number - a.number);
  }, []);
}

export function useAudioLog(id: string | undefined): AudioLog | undefined {
  return useLiveQuery(() => (id ? db.audioLogs.get(id) : undefined), [id]);
}

export async function allTitles(): Promise<string[]> {
  const all = await db.audioLogs.toArray();
  return all.map((a) => a.title);
}
