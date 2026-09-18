import Dexie, { type EntityTable } from 'dexie';

import type {
  AudioBlob,
  AudioLog,
  Digest,
  Entry,
  FollowUp,
  Link,
  Project,
  Prompt,
  Sequence,
  Settings,
  Thought,
} from './types';

export class CorpusDb extends Dexie {
  entries!: EntityTable<Entry, 'id'>;
  audioBlobs!: EntityTable<AudioBlob, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  links!: EntityTable<Link, 'id'>;
  sequences!: EntityTable<Sequence, 'id'>;
  digests!: EntityTable<Digest, 'id'>;
  audioLogs!: EntityTable<AudioLog, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  followups!: EntityTable<FollowUp, 'id'>;
  thoughts!: EntityTable<Thought, 'id'>;
  prompts!: EntityTable<Prompt, 'id'>;

  constructor() {
    super('corpus-app');
    this.version(1).stores({
      entries: 'id, createdAt, kind, importance, ai.status, ai.projectId',
      audioBlobs: 'id',
      projects: 'id, status',
      links: 'id, fromId, toId, state',
      sequences: 'id, projectId',
      digests: 'id, kind, periodStart',
      audioLogs: 'id, number, weekStart, status',
      settings: 'id',
    });
    this.version(2).stores({
      entries: 'id, createdAt, kind, importance, ai.status, ai.projectId, parentEntryId',
      followups: 'id, entryId, status, createdAt',
    });
    this.version(3)
      .stores({
        thoughts: 'id, projectId, createdAt',
        prompts: 'id, status, projectId, createdAt',
      })
      .upgrade(async (tx) => {
        // The redesigned app is black-first; 'system' meant "whatever the phone says".
        await tx.table('settings').toCollection().modify((s: { theme?: string }) => {
          if (s.theme === 'system') s.theme = 'dark';
        });
      });
  }
}

export const db = new CorpusDb();
