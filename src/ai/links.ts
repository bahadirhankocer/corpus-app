import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import type { Entry } from '../db/types';

export interface SuggestedLink {
  toId: string;
  kind: 'connection' | 'contradiction';
  rationale: string;
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
          toId: { type: 'STRING' },
          kind: { type: 'STRING', enum: ['connection', 'contradiction'] },
          rationale: { type: 'STRING' },
        },
        required: ['toId', 'kind', 'rationale'],
      },
    },
  },
  required: ['links'],
};

export async function findLinks(
  entry: Entry,
  candidates: Entry[],
  apiKey: string,
  model: string,
): Promise<SuggestedLink[]> {
  if (candidates.length === 0) return [];

  const source = entry.ai.summary || entry.text || entry.transcript || '';
  const candidateBlock = candidates
    .map((c) => `- id: ${c.id} | ${c.ai.summary || c.text || c.transcript || ''}`)
    .join('\n');

  const instructions = `Aşağıda bir fikir defterindeki YENİ girdi ve aynı projedeki DİĞER girdilerin özetleri var.
Görevin: yeni girdinin diğerleriyle güçlü bir bağlantısı ya da çelişkisi varsa bulmak.

Kurallar:
- En fazla 3 öneri döndür. Zayıf, yüzeysel benzerlikleri önerme; sadece gerçekten anlamlı olanları.
- kind "connection": iki fikir aynı temayı/motifi geliştiriyor ya da birbirini tamamlıyor.
- kind "contradiction": iki fikir birbiriyle çelişiyor ya da gerilim içinde.
- rationale en fazla bir cümle, neden bağlantılı/çelişkili olduğunu açıkla.
- toId, aşağıdaki listeden birebir bir id olmalı. Hiçbir güçlü bağlantı yoksa boş liste döndür.

Yeni girdi: ${source}

Diğer girdiler:
${candidateBlock}`;

  const result = await callGemini<{ links: SuggestedLink[] }>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: LINKS_SCHEMA,
  });

  const knownIds = new Set(candidates.map((c) => c.id));
  return result.links.filter((l) => knownIds.has(l.toId));
}
