import { creativeSystem, entryLine, entryText, projectBrief } from './context';
import { callGemini } from './gemini';
import type { Entry, Project, ThoughtKind } from '../db/types';

export interface ReflectThought {
  kind: ThoughtKind;
  text: string;
  relatedIds: string[];
}

export interface ReflectResult {
  compendium: string;
  thoughts: ReflectThought[];
}

const REFLECT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    compendium: { type: 'STRING' },
    thoughts: {
      type: 'ARRAY',
      maxItems: 2,
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['pattern', 'imagine', 'sequence', 'connection', 'contradiction'] },
          text: { type: 'STRING' },
          relatedIds: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['kind', 'text', 'relatedIds'],
      },
    },
  },
  required: ['compendium', 'thoughts'],
};

interface ReflectInput {
  entry: Entry;
  project: Project | undefined;
  neighbors: Entry[];
  styleGuide: string;
  apiKey: string;
  model: string;
}

/** The AI's reaction to a new entry: it revises its compendium and leaves at most two thoughts. */
export async function reflectOnEntry(input: ReflectInput): Promise<ReflectResult> {
  const { entry, project, neighbors, styleGuide, apiKey, model } = input;

  const instructions = `Bir fikir defterine yeni bir girdi eklendi. Sen bu defterin sessiz düşünürüsün.

${projectBrief(project)}

Derlemenin şu anki hali (senin çalışma notların):
${project?.compendium || '(henüz yok)'}

YENİ girdi:
- id: ${entry.id} | ${entryText(entry)}

Aynı alandaki diğer girdiler:
${neighbors.length ? neighbors.map(entryLine).join('\n') : '(başka girdi yok)'}

Görevin iki parça:
1) compendium: derlemeyi bu yeni girdiyi de kapsayacak şekilde yeniden yaz. Ekleme yapma, gözden geçirip sıkıştır. En fazla 150 kelime, kısa paragraflar. Temaları, tekrar eden motifleri, açık soruları ve girdiler arasındaki eksenleri yaz. Proje belirsizse boş string döndür.
2) thoughts: en fazla 2 kısa düşünce (her biri 1-2 cümle). Sadece gerçekten değerli olanı yaz, zorlama. Türler:
   - pattern: girdiler arasında fark ettiğin örüntü ya da tekrar eden motif.
   - imagine: iki ya da daha fazla girdiyi birbirine bağlayan hayali bir animasyon. Neyin neye dönüştüğünü somut anlat.
   - sequence: bu girdilerle kurulabilecek bir sekans senaryosu, sıra ve ritim.
   - connection: iki girdi arasındaki güçlü bağ.
   - contradiction: iki girdi arasındaki verimli çelişki.
   relatedIds sadece yukarıdaki listelerden birebir id içermeli (yeni girdinin id'si dahil).`;

  const result = await callGemini<ReflectResult>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: REFLECT_SCHEMA,
    temperature: 0.9,
  });

  const known = new Set([entry.id, ...neighbors.map((n) => n.id)]);
  return {
    compendium: result.compendium?.trim() ?? '',
    thoughts: (result.thoughts ?? [])
      .filter((t) => t.text?.trim())
      .map((t) => ({ ...t, text: t.text.trim(), relatedIds: (t.relatedIds ?? []).filter((id) => known.has(id)) })),
  };
}
