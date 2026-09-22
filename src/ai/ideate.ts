import { BILINGUAL, STR, aliasEntries, bi, creativeSystem, projectBrief } from './context';
import { stripBridges } from './corpus';
import { callGemini } from './gemini';
import type { Bi, CorpusDoc, Entry, Project, PromptKind, QuestionText } from '../db/types';

const QUESTION = {
  type: 'OBJECT',
  properties: {
    context: STR,
    question: STR,
    options: { type: 'ARRAY', items: STR, minItems: 3, maxItems: 3 },
  },
  required: ['context', 'question', 'options'],
};

const KIND_BRIEF: Record<PromptKind, string> = {
  deepen: 'deepen: girdilerinde gizli kalmış bir katmanı açacak, gerçekten cevaplanabilir tek bir soru sor. Seçenekler üç ayrı yön olsun.',
  imagine:
    'imagine: birbirinden uzak görünen iki girdiyi hayali bir HTML animasyonuyla bağla. Soru, hangi dönüşümün kurulacağını sorsun. Üç seçenek üç ayrı somut animasyon geçişi olsun (neyin neye nasıl dönüştüğü).',
  sequence:
    'sequence: girdilerden bir sekans senaryosu kur. Soru, açılışın ya da geçişin ne olacağını sorsun. Üç seçenek üç ayrı sıra ya da ritim önerisi olsun.',
  pattern: 'pattern: girdilerde fark ettiğin bir örüntüyü adlandır ve onu nereye taşıyacağını sor. Üç seçenek üç çılgın, beklenmedik yön olsun.',
};

interface IdeateInput {
  kind: PromptKind;
  project: Project | undefined;
  corpus: CorpusDoc | undefined;
  recent: Entry[];
  previousQuestions: string[];
  styleGuide: string;
  apiKey: string;
  model: string;
}

/** A question the AI brings on its own, drawn from the corpus and the newest entries. */
export async function ideatePrompt(input: IdeateInput): Promise<Bi<QuestionText>> {
  const { kind, project, corpus, recent, previousQuestions, styleGuide, apiKey, model } = input;
  const aliased = aliasEntries(recent, { maxChars: 400 });

  const instructions = `Yaratıcı süreci canlı kalsın diye ona günün rastgele bir anında kısa bir soru soracaksın. Cevaplamak zorunda değil; soru bir davet olsun, ödev değil. Cevabı Corpus'u bir adım daha net yapmalı.

${project ? projectBrief(project) : ''}

Corpus'un çekirdeği:
${corpus ? stripBridges(corpus.core.tr) : '(henüz yok)'}

Son girdiler:
${aliased.block}

Bu kez türün: ${KIND_BRIEF[kind]}

Kurallar:
- context: sorunun neden geldiğini söyleyen tek kısa cümle. En fazla 20 kelime.
- question: en fazla 2 kısa cümle.
- options: tam 3 seçenek, her biri en fazla 14 kelime, birbirinden gerçekten ayrışsın.
- Daha önce sorduklarını tekrar etme:
${previousQuestions.length ? previousQuestions.map((q) => `  · ${q}`).join('\n') : '  (yok)'}
- ${BILINGUAL}`;

  return callGemini<Bi<QuestionText>>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: bi(QUESTION),
    temperature: 1,
  });
}
