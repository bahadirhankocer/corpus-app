import type { Category } from '../db/types';
import i18n from '../i18n';

export const ALL_CATEGORIES: Category[] = ['theme', 'sound', 'voiceover', 'scene', 'motion'];

/** Short mono code for a category, in the current language. */
export function categoryCode(category: Category): string {
  return i18n.t(`categoryCode.${category}`);
}
