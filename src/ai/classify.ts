import { blobToBase64, callGemini } from './gemini';
import { CATEGORY_VALUES, SYSTEM_INSTRUCTION } from './prompts';
import type { Category, Entry, Project } from '../db/types';

export interface ClassifyResult {
  transcript?: string;
  categories: Category[];
  projectId: string | null;
  projectConfidence: number;
  tags: string[];
  summary: string;
}

const CLASSIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', nullable: true },
    categories: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: CATEGORY_VALUES as unknown as string[] },
    },
    projectId: { type: 'STRING', nullable: true },
    projectConfidence: { type: 'NUMBER' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    summary: { type: 'STRING' },
  },
  required: ['categories', 'tags', 'summary', 'projectConfidence'],
};

function projectsBlock(projects: Project[]): string {
  if (projects.length === 0) return '(tanımlı proje yok, projectId: null döndür)';
  return projects
    .map((p) => `- id: ${p.id} | ad: ${p.name} | açıklama: ${p.description} | anahtar kelimeler: ${p.keywords.join(', ')}`)
    .join('\n');
}

export async function classifyEntry(
  entry: Entry,
  audioBlob: Blob | undefined,
  projects: Project[],
  apiKey: string,
  model: string,
): Promise<ClassifyResult> {
  const instructions = `Bu bir fikir defteri girdisi. Görevlerin:
1. Ses girdisiyse metne dök (transcript alanı; yazı girdisiyse transcript'i boş bırak).
2. Şu beş kategoriden (theme, sound, voiceover, scene, motion) uygun olan(lar)ı seç; birden fazla olabilir.
3. Aşağıdaki proje listesinden en uygun olanın id'sini projectId olarak döndür; hiçbiri uymuyorsa null döndür. projectConfidence 0-1 arası bir güven skoru olsun.
4. Girdinin dilinde 3-6 kısa etiket üret.
5. Kullanıcının kendi ifadelerine sadık, tek cümlelik bir özet yaz.

Projeler:
${projectsBlock(projects)}`;

  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [{ text: instructions }];

  if (entry.kind === 'text' && entry.text) {
    parts.push({ text: `Girdi metni: ${entry.text}` });
  }
  if (entry.context) {
    parts.push({ text: `Bağlam: ${entry.context}` });
  }
  if (entry.kind === 'voice' && audioBlob) {
    const data = await blobToBase64(audioBlob);
    parts.push({ inlineData: { mimeType: audioBlob.type || 'audio/webm', data } });
  }

  const result = await callGemini<ClassifyResult>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts,
    responseSchema: CLASSIFY_SCHEMA,
  });

  const knownIds = new Set(projects.map((p) => p.id));
  return {
    ...result,
    categories: result.categories.filter((c): c is Category => (CATEGORY_VALUES as readonly string[]).includes(c)),
    projectId: result.projectId && knownIds.has(result.projectId) ? result.projectId : null,
  };
}
