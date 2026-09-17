import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

import { db } from './db';
import type { Sequence } from './types';

export async function createSequenceVersion(
  projectId: string,
  sections: Sequence['sections'],
  source: Sequence['source'],
): Promise<Sequence> {
  const existing = await db.sequences.where('projectId').equals(projectId).toArray();
  const nextVersion = existing.reduce((max, s) => Math.max(max, s.version), 0) + 1;
  const sequence: Sequence = {
    id: uuid(),
    projectId,
    version: nextVersion,
    source,
    sections,
    updatedAt: new Date().toISOString(),
  };
  await db.sequences.add(sequence);
  return sequence;
}

export async function updateSequenceSections(id: string, sections: Sequence['sections']): Promise<void> {
  await db.sequences.update(id, { sections, updatedAt: new Date().toISOString() });
}

export function useSequenceVersions(projectId: string | undefined): Sequence[] | undefined {
  return useLiveQuery(
    async () => {
      if (!projectId) return [];
      const all = await db.sequences.where('projectId').equals(projectId).toArray();
      return all.sort((a, b) => b.version - a.version);
    },
    [projectId],
  );
}

export function useLatestSequence(projectId: string | undefined): Sequence | undefined {
  const versions = useSequenceVersions(projectId);
  return versions?.[0];
}
