import Dexie from 'dexie';

import { db } from './db';
import type { Settings } from './types';

/**
 * Copies a notebook database left by an earlier build of the app (same origin, different name) into
 * this one, then removes it. Rows already present here are kept and only missing ones are copied, so it
 * is safe to run on every start. The old database is deleted only after every table was copied.
 */
export async function importLegacyDatabases(): Promise<void> {
  if (typeof indexedDB.databases !== 'function') return;
  const infos = await indexedDB.databases();

  for (const info of infos) {
    const name = info.name;
    if (!name || name === db.name) continue;

    const legacy = new Dexie(name);
    try {
      await legacy.open();
    } catch {
      continue;
    }
    const legacyTables = new Set(legacy.tables.map((t) => t.name));
    if (!legacyTables.has('entries') || !legacyTables.has('settings')) {
      legacy.close();
      continue;
    }

    let complete = true;
    for (const target of db.tables) {
      if (!legacyTables.has(target.name)) continue;
      try {
        const rows = (await legacy.table(target.name).toArray()) as Record<string, unknown>[];
        if (target.name === 'settings') {
          const old = rows.find((r) => r.id === 'app') as Settings | undefined;
          const current = await db.settings.get('app');
          if (old && !current) await db.settings.put(old);
          else if (old && current && !current.geminiApiKey && old.geminiApiKey) {
            await db.settings.update('app', { geminiApiKey: old.geminiApiKey, aiEnabled: true });
          }
          continue;
        }
        const keyPath = target.schema.primKey.keyPath as string;
        const existing = new Set(await target.toCollection().primaryKeys());
        const missing = rows.filter((r) => !existing.has(r[keyPath] as string));
        if (missing.length > 0) await target.bulkPut(missing);
        if ((await target.count()) < rows.length) complete = false;
      } catch {
        complete = false;
      }
    }

    legacy.close();
    if (complete) await Dexie.delete(name);
  }
}
