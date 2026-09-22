import { TRANSLATION_RULES, TRANSLATION_SCHEMA } from './classify';
import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import type { Entry, EntryTranslation, Lang } from '../db/types';
import { entryOriginal } from '../i18n/localize';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    lang: { type: 'STRING', enum: ['tr', 'en'] },
    tr: TRANSLATION_SCHEMA,
    en: TRANSLATION_SCHEMA,
  },
  required: ['lang', 'tr', 'en'],
};

export interface TranslateResult {
  lang: Lang;
  tr: EntryTranslation;
  en: EntryTranslation;
}

/** Translations for an entry that was written before 0.3.0, edited, or answered in free text. */
export async function translateEntry(entry: Entry, apiKey: string, model: string): Promise<TranslateResult> {
  const answers = (entry.thread ?? []).map((t, i) => `${i + 1}. ${typeof t.answer === 'string' ? t.answer : t.answer.tr}`);
  const instructions = `Aşağıdaki fikir girdisini iki dile hazırla. "lang" girdinin yazıldığı dil olsun.

${TRANSLATION_RULES}

${entry.title ? `Başlık: ${entry.title}\n` : ''}Metin: ${entryOriginal(entry)}
${answers.length ? `Soru-cevap cevapları (thread):\n${answers.join('\n')}` : ''}`;

  const result = await callGemini<TranslateResult>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: SCHEMA,
  });
  return { ...result, lang: result.lang === 'en' ? 'en' : 'tr' };
}
