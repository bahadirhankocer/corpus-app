export type Category = 'theme' | 'sound' | 'voiceover' | 'scene' | 'motion';

export type AiStatus = 'pending' | 'processing' | 'done' | 'error' | 'disabled';

export type Lang = 'tr' | 'en';

/** A text the AI wrote in both languages, so switching language changes everything at once. */
export type Bi<T = string> = Record<Lang, T>;

/** Older records hold a single string; everything written from 0.3.0 on is bilingual. */
export type LocalText = string | Bi;

export interface EntryTranslation {
  title?: string;
  text?: string;
  summary?: string;
  tags?: string[];
  /** translated thread answers, same order as `Entry.thread` */
  thread?: string[];
}

/** A follow-up question the AI asked about an entry, and how it was answered. */
export interface ThreadItem {
  question: LocalText;
  /** an option picked from a bilingual question is stored in both languages */
  answer: LocalText;
  at: string;
}

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
  /** the question from the AI that this entry answers, when it was written in reply to one */
  promptQuestion?: LocalText;
  thread?: ThreadItem[];
  /** the language the user wrote in */
  lang?: Lang;
  i18n?: Partial<Record<Lang, EntryTranslation>>;
  /** signature of the source text the translations were made for */
  i18nFor?: string;
  ai: {
    status: AiStatus;
    categories: Category[];
    projectId?: string;
    projectConfidence?: number;
    tags: string[];
    summary?: string;
    error?: string;
    processedAt?: string;
    /** false while the enrichment chain (translation, follow-up, links) is still owed */
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
  manifesto?: LocalText;
  /** how the AI should work inside this project */
  procedure?: LocalText;
}

export type PromptKind = 'deepen' | 'imagine' | 'sequence' | 'pattern';

export interface QuestionText {
  context?: string;
  question: string;
  options: string[];
}

export interface Prompt {
  id: string;
  kind: PromptKind;
  projectId?: string;
  /** why the AI is asking, shown before the question */
  context: string;
  question: string;
  options: string[];
  i18n?: Bi<QuestionText>;
  status: 'pending' | 'answered' | 'skipped';
  answerEntryId?: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  entryId: string;
  question: string;
  options: string[];
  i18n?: Bi<QuestionText>;
  status: 'pending' | 'answered' | 'dismissed';
  answerEntryId?: string;
  createdAt: string;
}

export interface Link {
  id: string;
  fromId: string;
  toId: string;
  kind: 'connection' | 'contradiction';
  rationale: LocalText;
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
  body: LocalText;
  entryIds: string[];
  createdAt: string;
}

export interface AudioLog {
  id: string;
  number: number;
  title: string;
  weekStart: string;
  /** end of the period this log covers; the next log starts here */
  rangeEnd?: string;
  lang: Lang;
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

export interface CorpusBridge {
  id: string;
  term: Bi;
  why: Bi;
  entryIds: string[];
}

/** One version of the living text. A new version is written after entries change. */
export interface CorpusDoc {
  id: string;
  createdAt: string;
  /** fingerprint of the entries it was written from */
  sourceSig: string;
  entryCount: number;
  title: Bi;
  core: Bi;
  direction: Bi;
  sections: { heading: Bi; body: Bi }[];
  bridges: CorpusBridge[];
  /** how the newest entries changed the corpus, used for the echo notification */
  delta: Bi;
  /** tomorrow morning's notification */
  morning: Bi;
}

export interface DossierTheme {
  key: string;
  name: Bi;
  description: Bi;
  entryIds: string[];
}

/** The material a video needs, derived from the corpus less often than the corpus itself. */
export interface Dossier {
  id: string;
  createdAt: string;
  entryCount: number;
  candidate: { title: Bi; logline: Bi; structure: Bi };
  brief: Bi;
  scenario: Bi;
  themes: DossierTheme[];
  sideIdeas: { text: Bi; entryIds: string[] }[];
}

export interface Sketch {
  key: string;
  html: string;
  createdAt: string;
}

/** A notification waiting to be shown by the service worker when a push arrives. */
export interface Note {
  id: string;
  kind: 'listen' | 'echo' | 'morning';
  body: Bi;
  dueAt?: string;
  usedAt?: string;
  createdAt: string;
}

export interface Settings {
  id: 'app';
  lang: Lang;
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
    lang: Lang;
    cues: boolean;
  };
  /** questions the AI writes on its own while the app is open */
  prompts: {
    perDay: 1 | 2 | 3;
    startHour: number;
    endHour: number;
    lastCreatedAt?: string;
  };
  /** push notifications per day */
  notify: {
    listen: number;
    questions: number;
    morning: boolean;
  };
  lastNotesAt?: string;
  pushWorkerUrl?: string;
  pushSubscribed?: boolean;
  /** one-off data migrations that already ran */
  dataVersion?: number;
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
  notify: { listen: 2, questions: 1, morning: true },
};
