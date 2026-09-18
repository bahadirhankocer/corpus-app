import { creativeSystem, entryLine, projectBrief } from './context';
import { callGemini } from './gemini';
import type { Entry, Project, PromptKind } from '../db/types';

export interface IdeatedPrompt {
  context: string;
  question: string;
  options: [string, string, string];
}

const IDEATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    context: { type: 'STRING' },
    question: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 3 },
  },
  required: ['context', 'question', 'options'],
};

const KIND_BRIEF: Record<PromptKind, string> = {
  deepen: 'deepen: kullanıcının girdilerinde gizli kalmış bir katmanı açacak, gerçekten cevaplanabilir tek bir soru sor. Seçenekler üç ayrı yön olsun.',
  imagine:
    'imagine: birbirinden uzak görünen iki girdiyi hayali bir animasyonla bağla. Soru, hangi dönüşümün kurulacağını sorsun. Üç seçenek üç ayrı somut animasyon geçişi olsun (neyin neye nasıl dönüştüğü).',
  sequence:
    'sequence: girdilerden bir sekans senaryosu kur. Soru, açılışın ya da geçişin ne olacağını sorsun. Üç seçenek üç ayrı sıra ya da ritim önerisi olsun.',
  pattern:
    'pattern: girdilerde fark ettiğin bir örüntüyü adlandır ve onu nereye taşıyacağını sor. Üç seçenek üç çılgın, beklenmedik yön olsun.',
};

interface IdeateInput {
  kind: PromptKind;
  project: Project | undefined;
  recent: Entry[];
  previousQuestions: string[];
  styleGuide: string;
  apiKey: string;
  model: string;
}

/** A question the AI brings to the user on its own, drawn from the project's own material. */
export async function ideatePrompt(input: IdeateInput): Promise<IdeatedPrompt> {
  const { kind, project, recent, previousQuestions, styleGuide, apiKey, model } = input;

  const instructions = `Kullanıcının yaratıcı sürecini canlı tutmak için ona günün rastgele bir anında kısa bir soru soracaksın. Cevaplamak zorunda değil, o yüzden soru davet gibi olmalı, ödev gibi değil.

${projectBrief(project)}

Derlemen (senin çalışma notların):
${project?.compendium || '(henüz yok)'}

Son girdiler:
${recent.map(entryLine).join('\n')}

Bu kez türün: ${KIND_BRIEF[kind]}

Kurallar:
- context: sorunun neden geldiğini söyleyen tek kısa cümle ("Repetition için son üç girdide tekrar eden bir eksen gördüm." gibi). En fazla 20 kelime.
- question: en fazla 2 kısa cümle.
- options: tam 3 seçenek, her biri en fazla 14 kelime, birbirinden gerçekten ayrışsın.
- Dil, girdilerin diliyle aynı olsun.
- Daha önce sorduklarını tekrar etme:
${previousQuestions.length ? previousQuestions.map((q) => `  · ${q}`).join('\n') : '  (yok)'}`;

  return callGemini<IdeatedPrompt>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: IDEATE_SCHEMA,
    temperature: 1,
  });
}
