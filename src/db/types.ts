export type Category = 'theme' | 'sound' | 'voiceover' | 'scene' | 'motion';

export type AiStatus = 'pending' | 'processing' | 'done' | 'error' | 'disabled';

export interface Entry {
  id: string;
  createdAt: string;
  updatedAt: string;
  kind: 'text' | 'voice';
  text?: string;
  audioId?: string;
  transcript?: string;
  title?: string;
  importance: 1 | 2 | 3;
  context?: string;
  ai: {
    status: AiStatus;
    categories: Category[];
    projectId?: string;
    projectConfidence?: number;
    tags: string[];
    summary?: string;
    error?: string;
    processedAt?: string;
  };
  overrides: {
    categories?: Category[];
    projectId?: string;
    tags?: string[];
  };
  sync: { driveFileId?: string; dirty: boolean };
}

export interface AudioBlob {
  id: string;
  blob: Blob;
  mime: string;
  durationSec: number;
  driveFileId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  status: 'active' | 'archived';
}

export interface Link {
  id: string;
  fromId: string;
  toId: string;
  kind: 'connection' | 'contradiction';
  rationale: string;
  state: 'suggested' | 'accepted' | 'dismissed';
  createdAt: string;
}

export interface Sequence {
  id: string;
  projectId: string;
  version: number;
  source: 'ai' | 'user';
  sections: {
    id: string;
    label: string;
    entryIds: string[];
    note?: string;
  }[];
  updatedAt: string;
}

export interface Digest {
  id: string;
  kind: 'daily' | 'weekly';
  periodStart: string;
  body: string;
  entryIds: string[];
  createdAt: string;
}

export interface AudioLog {
  id: string;
  number: number;
  title: string;
  weekStart: string;
  lang: 'tr' | 'en';
  version: number;
  paragraphs: {
    text: string;
    sourceEntryIds: string[];
    cue?: string;
  }[];
  patreonIntro: string;
  lintWarnings: string[];
  status: 'draft' | 'final' | 'recorded' | 'published';
  createdAt: string;
}

export interface Settings {
  id: 'app';
  lang: 'tr' | 'en';
  theme: 'light' | 'dark' | 'system';
  geminiApiKey?: string;
  model: string;
  aiEnabled: boolean;
  driveConnected: boolean;
  activeProjectId?: string;
  styleGuide: string;
  audioLog: {
    nextNumber: number;
    targetMinutes: number;
    wordsPerMinute: number;
    lang: 'tr' | 'en';
    cues: boolean;
  };
}

export const DEFAULT_STYLE_GUIDE = `Register: duru. Süssüz, açık, fazla açıklamasız, kasıntısız.
Ana fikir en başta söylenir.
Uzun tire (—) kullanılmaz (bölüm başlığı formatı hariç).
Karşıtlık çiftleri kullanılmaz: "X değil Y", "X'i bırakıp Y'ye başlar", "X yapmaz, Y yapar", "not X but Y" vb.
Performatif samimiyet yok.
Kavram paleti serbestçe kullanılabilir: hauntology, communitas, entrainment, transient hypofrontality, spectromorphology.
Kendi video işleri için "essay" denir, "film" denmez.
Akademik atıf yapılırsa sayfa numarası zorunlu (ör. "Koçer, 2023, s. 14").`;

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  lang: 'tr',
  theme: 'system',
  model: 'gemini-2.5-flash',
  aiEnabled: false,
  driveConnected: false,
  styleGuide: DEFAULT_STYLE_GUIDE,
  audioLog: {
    nextNumber: 2,
    targetMinutes: 6,
    wordsPerMinute: 130,
    lang: 'tr',
    cues: true,
  },
};
