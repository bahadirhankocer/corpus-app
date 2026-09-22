import type { Entry, Lang, LocalText, QuestionText } from '../db/types';

export function asLang(language: string): Lang {
  return language.startsWith('en') ? 'en' : 'tr';
}

export function loc(value: LocalText | undefined, lang: Lang): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.tr || value.en || '';
}

export function locQuestion(
  source: { context?: string; question: string; options: string[]; i18n?: Record<Lang, QuestionText> },
  lang: Lang,
): QuestionText {
  return source.i18n?.[lang] ?? { context: source.context, question: source.question, options: source.options };
}

function fnv(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function entryOriginal(entry: Entry): string {
  return entry.text ?? entry.transcript ?? '';
}

/** Changes whenever something the user wrote in this entry changes, so stale translations are ignored. */
export function entrySignature(entry: Entry): string {
  const answers = (entry.thread ?? []).map((t) => (typeof t.answer === 'string' ? t.answer : ''));
  return fnv([entry.title ?? '', entryOriginal(entry), ...answers].join('␞'));
}

export interface EntryView {
  title?: string;
  text: string;
  summary?: string;
  tags: string[];
  translated: boolean;
  thread: { question: string; answer: string; at: string }[];
}

/** The entry as it should read in `lang`: translated where a current translation exists. */
export function entryView(entry: Entry, lang: Lang): EntryView {
  const fresh = entry.i18nFor === entrySignature(entry);
  const own = entry.i18n?.[lang];
  const foreign = Boolean(entry.lang && entry.lang !== lang && fresh && own?.text);
  return {
    title: foreign && own?.title ? own.title : entry.title,
    text: foreign ? own!.text! : entryOriginal(entry),
    summary: own?.summary ?? entry.ai.summary,
    tags: entry.overrides.tags ?? own?.tags ?? entry.ai.tags,
    translated: foreign,
    thread: (entry.thread ?? []).map((item, i) => ({
      question: loc(item.question, lang),
      answer:
        typeof item.answer === 'string'
          ? (fresh && entry.lang !== lang ? own?.thread?.[i] : undefined) || item.answer
          : loc(item.answer, lang),
      at: item.at,
    })),
  };
}

export function entryHeadline(entry: Entry, lang: Lang): string {
  const view = entryView(entry, lang);
  return view.title || view.text || view.summary || '';
}
