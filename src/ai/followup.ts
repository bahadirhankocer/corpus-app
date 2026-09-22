import { BILINGUAL, PERSONA, STR, TONE, bi } from './context';
import { callGemini } from './gemini';
import type { Bi, Entry, QuestionText } from '../db/types';
import { entryOriginal, loc } from '../i18n/localize';

const QUESTION = {
  type: 'OBJECT',
  properties: {
    question: STR,
    options: { type: 'ARRAY', items: STR, minItems: 3, maxItems: 3 },
  },
  required: ['question', 'options'],
};

/** One question that opens the entry up from the inside, in both languages. */
export async function generateFollowUp(entry: Entry, apiKey: string, model: string): Promise<Bi<QuestionText>> {
  const thread = (entry.thread ?? [])
    .map((t) => `- Soru: ${loc(t.question, 'tr')} / Cevap: ${loc(t.answer, 'tr')}`)
    .join('\n');

  const instructions = `Bu bir fikir girdisi. Görevin, onun bu fikri kendi içinde daha derine açmasına yardım edecek TEK bir soru üretmek.

Kurallar:
- Soru onun kendi kelimelerinden ve fikrinden doğsun; yeni bir konu açma, söylediğinin içinde durup derinleş.
- Daha önce sorulanları tekrar etme; önceki cevapların açtığı kapıdan bir adım ileri git.
- Soru kısa, doğrudan, tek cümle olsun. Retorik olmasın, gerçekten cevaplanabilir olsun.
- Tam olarak 3 kısa cevap seçeneği üret; fikri birbirinden gerçekten ayrışan yönlere taşısınlar.
- ${BILINGUAL}

Girdi: ${entryOriginal(entry)}
${entry.ai.summary ? `Özet: ${entry.ai.summary}` : ''}
${thread ? `Daha önce sorulanlar ve cevapları:\n${thread}` : ''}`;

  return callGemini<Bi<QuestionText>>({
    apiKey,
    model,
    systemInstruction: `${PERSONA}\n\n${TONE}\nÇıktı yalnızca istenen JSON şemasına uygun olmalı.`,
    parts: [{ text: instructions }],
    responseSchema: bi(QUESTION),
    temperature: 0.8,
  });
}
