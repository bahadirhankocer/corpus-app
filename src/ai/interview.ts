import { creativeSystem } from './context';
import { callGemini } from './gemini';

export interface InterviewTurn {
  question: string;
  answer: string;
}

export interface InterviewQuestion {
  question: string;
  options: [string, string, string];
}

export const INTERVIEW_ROUNDS = 4;

const QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    question: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 3 },
  },
  required: ['question', 'options'],
};

const PROCEDURE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    manifesto: { type: 'STRING' },
    procedure: { type: 'STRING' },
  },
  required: ['manifesto', 'procedure'],
};

function transcript(turns: InterviewTurn[]): string {
  return turns.length ? turns.map((t, i) => `${i + 1}. Soru: ${t.question}\n   Cevap: ${t.answer}`).join('\n') : '(henüz soru sorulmadı)';
}

interface Common {
  name: string;
  description: string;
  turns: InterviewTurn[];
  styleGuide: string;
  apiKey: string;
  model: string;
}

/** Next question of the short project interview. Each one builds on the previous answers. */
export async function nextInterviewQuestion(input: Common): Promise<InterviewQuestion> {
  const { name, description, turns, styleGuide, apiKey, model } = input;
  const instructions = `Kullanıcı yeni bir proje açtı ve sen bu projenin "alt metnini" anlamak için ${INTERVIEW_ROUNDS} soruluk kısa bir görüşme yapıyorsun. Bu görüşmeden sonra projenin manifestosunu ve senin bu projedeki çalışma prosedürünü yazacaksın.

Proje adı: ${name}
Açıklama: ${description || '(yok)'}

Şu ana kadar:
${transcript(turns)}

Şimdi ${turns.length + 1}. soruyu sor (toplam ${INTERVIEW_ROUNDS}).
Sırayla şu eksenleri gez, önceki cevaplara göre uyarla: (1) proje gerçekte ne hakkında, (2) hangi duygu ya da ton, (3) hangi biçim ya da malzeme (animasyon, essay, ses...), (4) ne olmamalı ya da neyden kaçınılmalı.
Soru kısa ve tek cümle olsun. Tam 3 seçenek ver, her biri en fazla 12 kelime, birbirinden ayrışsın.
Dil: Türkçe.`;

  return callGemini<InterviewQuestion>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: QUESTION_SCHEMA,
    temperature: 0.8,
  });
}

/** Turns the interview into the project's manifesto and the AI's working procedure. */
export async function composeProjectProcedure(input: Common): Promise<{ manifesto: string; procedure: string }> {
  const { name, description, turns, styleGuide, apiKey, model } = input;
  const instructions = `Aşağıdaki görüşmeye dayanarak bu proje için iki metin yaz.

Proje adı: ${name}
Açıklama: ${description || '(yok)'}

Görüşme:
${transcript(turns)}

1) manifesto: projenin ne olduğunu ve neyi hedeflediğini anlatan en fazla 60 kelimelik süssüz bir paragraf. Kullanıcının kendi ifadelerine sadık kal.
2) procedure: senin (AI'ın) bu projede nasıl çalışacağını tarif eden en fazla 90 kelimelik kısa bir prosedür. Hangi tür girdilere dikkat edeceğini, hangi türde sorular soracağını, hangi tür animasyon ve sekans önerileri getireceğini ve neyden kaçınacağını yaz.
Dil: Türkçe.`;

  return callGemini<{ manifesto: string; procedure: string }>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: PROCEDURE_SCHEMA,
    temperature: 0.5,
  });
}
