import type { Category } from '../db/types';

export const ALL_CATEGORIES: Category[] = ['theme', 'sound', 'voiceover', 'scene', 'motion'];

export const CATEGORY_CODES: Record<Category, string> = {
  theme: 'TMA',
  sound: 'SES',
  voiceover: 'VO',
  scene: 'SHN',
  motion: 'ANM',
};
