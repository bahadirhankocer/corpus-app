import type { Category, Entry } from './types';

export function effectiveCategories(entry: Entry): Category[] {
  return entry.overrides.categories ?? entry.ai.categories;
}

export function effectiveProjectId(entry: Entry): string | undefined {
  return entry.overrides.projectId ?? entry.ai.projectId;
}

export function effectiveTags(entry: Entry): string[] {
  return entry.overrides.tags ?? entry.ai.tags;
}
