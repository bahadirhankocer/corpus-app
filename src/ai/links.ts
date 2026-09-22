import { BILINGUAL, aliasEntries } from './context';
import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import type { Bi, Entry } from '../db/types';
import { entryOriginal } from '../i18n/localize';

export interface SuggestedLink {
  toId: string;
  kind: 'connection' | 'contradiction';
  rationale: Bi;
}

const LINKS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    links: {
      type: 'ARRAY',
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: {
          to: { type: 'STRING' },
          kind: { type: 'STRING', enum: ['connection', 'contradiction'] },
          rationale_tr: { type: 'STRING' },
          rationale_en: { type: 'STRING' },
        },
        required: ['to', 'kind', 'rationale_tr', 'rationale_en'],
      },
    },
  },
  required: ['links'],
};

interface RawLink {
  to: string;
  kind: 'connection' | 'contradiction';
  rationale_tr: string;
  rationale_en: string;
}

export async function findLinks(entry: Entry, candidates: Entry[], apiKey: string, model: string): Promise<SuggestedLink[]> {
  if (candidates.length === 0) return [];
  const aliased = aliasEntries(candidates, { maxChars: 260 });

  const instructions = `Aşağıda YENİ bir girdi ve DİĞER girdiler var. Yeni girdinin diğerleriyle güçlü bir bağlantısı ya da çelişkisi varsa bul.

Kurallar:
- En fazla 3 öneri. Zayıf, yüzeysel benzerlikleri önerme.
- kind "connection": iki fikir aynı temayı ya da motifi geliştiriyor, birbirini tamamlıyor.
- kind "contradiction": iki fikir birbiriyle verimli bir gerilim içinde.
- rationale en fazla bir cümle. ${BILINGUAL} (rationale_tr ve rationale_en)
- "to" alanı aşağıdaki listeden birebir bir takma ad olsun (E1, E2...). Güçlü bağ yoksa boş liste döndür.

Yeni girdi: ${entryOriginal(entry)}

Diğer girdiler:
${aliased.block}`;

  const result = await callGemini<{ links: RawLink[] }>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: LINKS_SCHEMA,
  });

  return result.links.flatMap((l) => {
    const toId = aliased.resolve(l.to);
    return toId ? [{ toId, kind: l.kind, rationale: { tr: l.rationale_tr, en: l.rationale_en } }] : [];
  });
}
