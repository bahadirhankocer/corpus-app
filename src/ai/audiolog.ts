import { callGemini } from './gemini';
import { SYSTEM_INSTRUCTION } from './prompts';
import type { Entry } from '../db/types';

const SERIES_CONTEXT = `Seri bağlamı (sabit):
- Format: "AUDIO LOG 00N — BAŞLIK" şeklinde yayınlanır; sen sadece BAŞLIK kısmını üret (tek kavram, büyük harf).
- Kayıt bantta yapılır (wow, flutter dahil); ses tek bir tonda, tonal ifade azaltılmış, "çıplak" okunur.
- Görselde bant döner, kayıt boyunca yavaş bir geri zoom olur ve zoom ile oda sesi giderek duyulur hale gelir.
- Seri, "Repetition" essay'inin evreninde geçer ama tam olarak değil; arşiv estetiği korunur.
- Her Patreon yayınından önce bölümü özetleyen kısa bir giriş metni gelir.

Metin nitelikleri:
- Ontolojik bilinç akışı: haftanın motifleri arasında çağrışımla ilerleyen, kesintisiz, tek sesli düşünme.
- Monoton okumaya uygun ritim: kısa ve orta uzunlukta cümleler, vurgu gerektiren retorik yapılar yok, ünlem yok, soru cümlesi az.
- Yapım işaretleri (opsiyonel): köşeli parantezde kısa notlar, ör. "[oda sesi belirginleşir]".`;

export interface AudioLogDraft {
  title: string;
  paragraphs: { text: string; sourceEntryIds: string[]; cue?: string }[];
  patreonIntro: string;
}

const AUDIOLOG_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    paragraphs: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          sourceEntryIds: { type: 'ARRAY', items: { type: 'STRING' } },
          cue: { type: 'STRING', nullable: true },
        },
        required: ['text', 'sourceEntryIds'],
      },
    },
    patreonIntro: { type: 'STRING' },
  },
  required: ['title', 'paragraphs', 'patreonIntro'],
};

export async function generateAudioLogDraft(
  weekEntries: Entry[],
  styleGuide: string,
  targetWords: number,
  previousTitles: string[],
  lang: 'tr' | 'en',
  apiKey: string,
  model: string,
): Promise<AudioLogDraft> {
  const block = weekEntries
    .map((e) => `- id: ${e.id} | ${e.ai.summary || e.text || e.transcript || ''}`)
    .join('\n');

  const instructions = `${SERIES_CONTEXT}

Kullanıcının stil kılavuzu (uy):
${styleGuide}

Kurallar:
- Fikir içeriği YALNIZCA aşağıdaki haftanın girdilerinden gelsin; kaynağı olmayan paragraf üretme.
- Her paragraf en az bir girdi id'sine dayanmalı (sourceEntryIds).
- Hedef kelime sayısı: ${targetWords} (±%15 içinde kal).
- Bu başlıklar daha önce kullanıldı, tekrar etme: ${previousTitles.join(', ') || '(yok)'}.
- ${lang === 'tr' ? 'Türkçe yaz.' : 'Write in English.'}

Bu haftanın girdileri:
${block}`;

  return callGemini<AudioLogDraft>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: AUDIOLOG_SCHEMA,
  });
}

interface FlaggedParagraph {
  index: number;
  text: string;
  issues: string[];
}

const REWRITE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rewrites: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'NUMBER' },
          text: { type: 'STRING' },
        },
        required: ['index', 'text'],
      },
    },
  },
  required: ['rewrites'],
};

export async function rewriteFlaggedParagraphs(
  flagged: FlaggedParagraph[],
  styleGuide: string,
  lang: 'tr' | 'en',
  apiKey: string,
  model: string,
): Promise<Map<number, string>> {
  const block = flagged
    .map((f) => `- index: ${f.index} | sorunlar: ${f.issues.join('; ')} | metin: ${f.text}`)
    .join('\n');

  const instructions = `Aşağıdaki paragrafları, belirtilen stil sorunlarını gidererek yeniden yaz. İçeriği ve anlamı koru, yalnızca stil ihlallerini düzelt.

Stil kılavuzu:
${styleGuide}

${lang === 'tr' ? 'Türkçe yaz.' : 'Write in English.'}

Paragraflar:
${block}`;

  const result = await callGemini<{ rewrites: { index: number; text: string }[] }>({
    apiKey,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [{ text: instructions }],
    responseSchema: REWRITE_SCHEMA,
  });

  return new Map(result.rewrites.map((r) => [r.index, r.text]));
}
