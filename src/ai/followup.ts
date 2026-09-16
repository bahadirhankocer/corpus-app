import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import type { Entry } from '../db/types';

export interface FollowUpResult {
  question: string;
  options: [string, string, string];
}

const FOLLOWUP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    question: { type: 'STRING' },
    options: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['question', 'options'],
};

export async function generateFollowUp(entry: Entry, apiKey: string, model: string): Promise<FollowUpResult> {
  const source = entry.text || entry.transcript || entry.ai.summary || '';
  const instructions = `Bu bir fikir defteri girdisi. Görevin, kullanıcının bu fikri kendi içinde daha derin keşfetmesine yardım edecek TEK bir soru üretmek.

Kurallar:
- Soru, kullanıcının kendi kelimelerinden ve fikrinden doğmalı; yeni bir konu açma, onun söylediğinin içinde durup derinleş.
- Soru kısa, doğrudan, tek cümle olmalı. Retorik olmasın, gerçekten cevaplanabilir olsun.
- Tam olarak 3 kısa cevap seçeneği üret. Bu seçenekler kullanıcının fikri farklı yönlere taşıyabileceği, birbirinden gerçekten ayrışan olası yönler olmalı (aynı şeyin eş anlamlıları olmasın).
- Soru ve seçenekler girdinin dilinde olsun (Türkçe girdiye Türkçe, İngilizce girdiye İngilizce).

Girdi: ${source}
${entry.ai.summary ? `Özet: ${entry.ai.summary}` : ''}
${entry.ai.categories.length ? `Kategoriler: ${entry.ai.categories.join(', ')}` : ''}`;

  const result = await callGemini<FollowUpResult>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: FOLLOWUP_SCHEMA,
  });

  return result;
}
