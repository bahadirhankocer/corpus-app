import Dexie, { type EntityTable } from 'dexie';

import type {
  AudioBlob,
  AudioLog,
  CorpusDoc,
  Digest,
  Dossier,
  Entry,
  FollowUp,
  Link,
  Note,
  Project,
  Prompt,
  Sequence,
  Settings,
  Sketch,
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
  prompts!: EntityTable<Prompt, 'id'>;
  corpora!: EntityTable<CorpusDoc, 'id'>;
  dossiers!: EntityTable<Dossier, 'id'>;
  sketches!: EntityTable<Sketch, 'key'>;
  notes!: EntityTable<Note, 'id'>;

  constructor() {
    super('corpus');
    this.version(1).stores({
      entries: 'id, createdAt, kind, importance, ai.status, ai.projectId, parentEntryId',
      audioBlobs: 'id',
      projects: 'id, status',
      links: 'id, fromId, toId, state',
      sequences: 'id, projectId',
      digests: 'id, kind, periodStart',
      audioLogs: 'id, number, weekStart, status',
      settings: 'id',
      followups: 'id, entryId, status, createdAt',
      prompts: 'id, status, projectId, createdAt',
      corpora: 'id, createdAt',
      dossiers: 'id, createdAt',
      sketches: 'key',
      notes: 'id, kind, createdAt',
    });
  }
}

export const db = new CorpusDb();
