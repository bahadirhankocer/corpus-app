import { STR } from './context';
import { blobToBase64, callGemini } from './gemini';
import { CATEGORY_VALUES, SYSTEM_INSTRUCTION } from './prompts';
import type { Category, Entry, EntryTranslation, Lang, Project } from '../db/types';

export interface ClassifyResult {
  transcript?: string;
  lang: Lang;
  categories: Category[];
  projectId: string | null;
  projectConfidence: number;
  tags: string[];
  summary: string;
  tr: EntryTranslation;
  en: EntryTranslation;
}

export const TRANSLATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', nullable: true },
    text: STR,
    summary: STR,
    tags: { type: 'ARRAY', items: STR },
    thread: { type: 'ARRAY', items: STR },
  },
  required: ['text', 'summary', 'tags'],
};

const CLASSIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', nullable: true },
    lang: { type: 'STRING', enum: ['tr', 'en'] },
    categories: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: CATEGORY_VALUES as unknown as string[] },
    },
    projectId: { type: 'STRING', nullable: true },
    projectConfidence: { type: 'NUMBER' },
    tr: TRANSLATION_SCHEMA,
    en: TRANSLATION_SCHEMA,
  },
  required: ['lang', 'categories', 'projectConfidence', 'tr', 'en'],
};

function projectsBlock(projects: Project[]): string {
  if (projects.length === 0) return '(tanımlı proje yok, projectId: null döndür)';
  return projects
    .map((p) => `- id: ${p.id} | ad: ${p.name} | açıklama: ${p.description} | anahtar kelimeler: ${p.keywords.join(', ')}`)
    .join('\n');
}

export const TRANSLATION_RULES = `Çeviri kuralları:
- "tr" ve "en" alanlarının ikisini de doldur. Girdinin kendi dilindeki alan metni birebir aynen korusun, diğer dildeki alan onun sadık bir çevirisi olsun.
- Kullanıcının sesini koru: kısa, dağınık ya da yarım cümleleri düzeltme, süsleme.
- summary: kullanıcının kendi ifadelerine sadık, tek cümlelik özet.
- tags: 3-6 kısa etiket.
- thread: varsa soru-cevap cevaplarının çevirisi, aynı sırayla.`;

export async function classifyEntry(
  entry: Entry,
  audioBlob: Blob | undefined,
  projects: Project[],
  apiKey: string,
  model: string,
): Promise<ClassifyResult> {
  const instructions = `Görevlerin:
1. Ses girdisiyse metne dök (transcript alanı; yazı girdisiyse transcript'i boş bırak). Ses girdisinde "text" alanları transkripti ve çevirisini taşısın.
2. Girdinin yazıldığı dili "lang" olarak döndür (tr ya da en).
3. Şu beş kategoriden (theme, sound, voiceover, scene, motion) uygun olan(lar)ı seç; birden fazla olabilir.
4. Aşağıdaki proje listesinden en uygun olanın id'sini projectId olarak döndür; hiçbiri uymuyorsa null döndür. projectConfidence 0-1 arası bir güven skoru olsun.

${TRANSLATION_RULES}

Projeler:
${projectsBlock(projects)}`;

  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [{ text: instructions }];

  if (entry.title) parts.push({ text: `Başlık: ${entry.title}` });
  if (entry.kind === 'text' && entry.text) parts.push({ text: `Girdi metni: ${entry.text}` });
  if (entry.context) parts.push({ text: `Bağlam: ${entry.context}` });
  if (entry.kind === 'voice' && audioBlob) {
    const data = await blobToBase64(audioBlob);
    parts.push({ inlineData: { mimeType: audioBlob.type || 'audio/webm', data } });
  }

  const result = await callGemini<Omit<ClassifyResult, 'tags' | 'summary'>>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts,
    responseSchema: CLASSIFY_SCHEMA,
  });

  const lang: Lang = result.lang === 'en' ? 'en' : 'tr';
  const knownIds = new Set(projects.map((p) => p.id));
  return {
    ...result,
    lang,
    tags: result[lang]?.tags ?? [],
    summary: result[lang]?.summary ?? '',
    categories: result.categories.filter((c): c is Category => (CATEGORY_VALUES as readonly string[]).includes(c)),
    projectId: result.projectId && knownIds.has(result.projectId) ? result.projectId : null,
  };
}
