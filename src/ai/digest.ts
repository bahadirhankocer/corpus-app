import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import { effectiveCategories } from '../db/effective';
import type { Entry, Project } from '../db/types';

const DIGEST_SCHEMA = {
  type: 'OBJECT',
  properties: {
    body: { type: 'STRING' },
  },
  required: ['body'],
};

export async function generateDigest(
  entries: Entry[],
  projects: Project[],
  kind: 'daily' | 'weekly',
  lang: 'tr' | 'en',
  apiKey: string,
  model: string,
): Promise<string> {
  const projectName = (id: string | undefined) => projects.find((p) => p.id === id)?.name;
  const block = entries
    .map(
      (e) =>
        `- ${e.ai.summary || e.text || e.transcript || ''} | proje: ${projectName(e.ai.projectId) ?? '—'} | kategoriler: ${effectiveCategories(e).join(', ')}`,
    )
    .join('\n');

  const period = kind === 'daily' ? 'dün' : 'bu hafta';
  const instructions = `Aşağıda ${period} girilen fikir defteri girdileri var. Bir gözlem özeti yaz:
- Tekrar eden motifler/temalar varsa belirt.
- Açık çelişkiler (birbirine ters düşen fikirler) varsa belirt.
- Proje bazında girdi dağılımından kısaca bahset.

Kurallar:
- Sadece gözlemle, hiçbir öneri veya yeni fikir sunma.
- Kısa, düz, 3-5 cümlelik bir paragraf olsun.
- ${lang === 'tr' ? 'Türkçe yaz.' : 'Write in English.'}

Girdiler:
${block}`;

  const result = await callGemini<{ body: string }>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: DIGEST_SCHEMA,
  });

  return result.body;
}
