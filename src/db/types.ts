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
  parentEntryId?: string;
  lastSurfacedAt?: string;
  ai: {
    status: AiStatus;
    categories: Category[];
    projectId?: string;
    projectConfidence?: number;
    tags: string[];
    summary?: string;
    error?: string;
    processedAt?: string;
    /** false while the reflection chain (follow-up, links, thoughts) is still owed */
    enriched?: boolean;
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
  /** what this project is really about, written by the AI after the interview */
  manifesto?: string;
  /** how the AI should work inside this project */
  procedure?: string;
  /** the AI's living compendium of the project, revised after every entry */
  compendium?: string;
  compendiumUpdatedAt?: string;
}

export type ThoughtKind = 'connection' | 'contradiction' | 'pattern' | 'imagine' | 'sequence' | 'note';

export interface Thought {
  id: string;
  kind: ThoughtKind;
  text: string;
  entryIds: string[];
  projectId?: string;
  createdAt: string;
}

export type PromptKind = 'deepen' | 'imagine' | 'sequence' | 'pattern';

export interface Prompt {
  id: string;
  kind: PromptKind;
  projectId?: string;
  /** why the AI is asking, shown before the question */
  context: string;
  question: string;
  options: string[];
  status: 'pending' | 'answered' | 'skipped';
  answerEntryId?: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  entryId: string;
  question: string;
  options: string[];
  status: 'pending' | 'answered' | 'dismissed';
  answerEntryId?: string;
  createdAt: string;
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
  lastResurfaceAt?: string;
  lastDailyDigestAt?: string;
  lastWeeklyDigestAt?: string;
  audioLog: {
    nextNumber: number;
    targetMinutes: number;
    wordsPerMinute: number;
    lang: 'tr' | 'en';
    cues: boolean;
  };
  /** proactive questions and their push notifications */
  prompts: {
    perDay: 1 | 2 | 3;
    startHour: number;
    endHour: number;
    lastCreatedAt?: string;
  };
  pushWorkerUrl?: string;
  pushSubscribed?: boolean;
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
  theme: 'dark',
  model: 'gemini-2.5-flash',
  aiEnabled: true,
  driveConnected: false,
  styleGuide: DEFAULT_STYLE_GUIDE,
  audioLog: {
    nextNumber: 2,
    targetMinutes: 6,
    wordsPerMinute: 130,
    lang: 'tr',
    cues: true,
  },
  prompts: { perDay: 2, startHour: 9, endHour: 22 },
};
