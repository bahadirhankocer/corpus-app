import { v4 as uuid } from 'uuid';

import { db } from './db';

export async function saveAudioBlob(blob: Blob, mime: string, durationSec: number): Promise<string> {
  const id = uuid();
  await db.audioBlobs.add({ id, blob, mime, durationSec });
  return id;
}

export async function getAudioBlob(id: string) {
  return db.audioBlobs.get(id);
}
