import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import { effectiveCategories, effectiveTags } from '../db/effective';
import type { Entry } from '../db/types';

export interface SequenceSection {
  label: string;
  entryIds: string[];
}

const SEQUENCE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          entryIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['label', 'entryIds'],
      },
    },
  },
  required: ['sections'],
};

export async function draftSequence(entries: Entry[], apiKey: string, model: string): Promise<SequenceSection[]> {
  const block = entries
    .map(
      (e) =>
        `- id: ${e.id} | ${e.ai.summary || e.text || e.transcript || ''} | kategoriler: ${effectiveCategories(e).join(', ')} | etiketler: ${effectiveTags(e).join(', ')}`,
    )
    .join('\n');

  const instructions = `Aşağıda bir projedeki tüm fikir defteri girdileri var. Görevin bunları mantıklı bir sekansa (bölümlere) dizmek — ör. Intro, Gelişme, Dönüm noktası, Sonuç gibi, ama projenin içeriğine uygun kendi bölüm adlarını üret.

Kurallar:
- Her girdi en fazla bir bölümde yer alsın.
- Bir bölüme sığmayan/yerleşmeyen girdileri "Yerleşmemiş" adlı son bölüme koy.
- Bölüm sırası, önerdiğin akış sırası olsun.
- Yeni fikir üretme, sadece verilen girdileri düzenle.

Girdiler:
${block}`;

  const result = await callGemini<{ sections: SequenceSection[] }>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: SEQUENCE_SCHEMA,
  });

  const knownIds = new Set(entries.map((e) => e.id));
  return result.sections.map((s) => ({ ...s, entryIds: s.entryIds.filter((id) => knownIds.has(id)) }));
}
