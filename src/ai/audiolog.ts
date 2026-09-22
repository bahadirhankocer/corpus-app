import { PERSONA, aliasEntries } from './context';
import { stripBridges } from './corpus';
import { callGemini } from './gemini';
import type { CorpusDoc, Entry, Lang, Link, Project } from '../db/types';
import { loc } from '../i18n/localize';

const SERIES_CONTEXT = `Seri: AUDIO LOG. "AUDIO LOG 00N — BAŞLIK" biçiminde yayınlanır; sen yalnızca BAŞLIK kısmını üretirsin (tek kavram, büyük harf).
Kayıt bantta yapılır (wow ve flutter dahil). Ses tek bir tonda, tonal ifade azaltılmış, "çıplak" okunur. Görselde bant döner, kayıt boyunca yavaş bir geri zoom olur ve zoom ile oda sesi giderek duyulur hale gelir. Seri, "Repetition" essay'inin evreninde geçer ama tam olarak değil; arşiv estetiği korunur. Her Patreon yayınından önce bölümü özetleyen kısa bir giriş metni gelir.`;

const FORMAT = `Biçim: kendi kendine konuşan bir ben. Bir arşivcinin kendi zihninin kaydını tutması. Dinleyen kişi şunu hissetmeli: "Bu adam kendi zihninde sörf yapıyor ve aşama aşama bir projeye gidiyor."

Yapı (hibrit):
1. Açılış: bir iki cümleyle hangi dönemin kaydı olduğu. Tarih aralığını söyle.
2. Kronolojik gövde: girdileri yazıldıkları sırayla, gün ve saatleriyle geç. Zamanı sade bir işaret olarak kullan ("Salı, gece iki on dört."). Her fikir için ne düşündüğünü birinci tekil şahısla anlat. Girdi metinlerini kelimesi kelimesine okuma; kendi sesiyle, yoğunlaştırarak aktar, ama onun kelimelerini ve imgelerini koru.
3. Tetiklenmeler: bir fikir başka birini doğurduysa bunu söyle ("Bu, üç gün sonra şunu tetikledi."). Bağlantılı girdiler listesini kullan.
4. Soru-cevaplar: AI'ın sorduğu soruları ve onun verdiği cevapları anlatıya ör. Soruyu kendi içinden gelmiş gibi söyle, cevabını ver ("Sonra kendime şunu sordum: ... Cevabım şuydu: ...").
5. Birleşme: dönemin ikinci yarısında eksenler birbirine yaklaşsın; dağınık notların nasıl tek bir düşünceye doğru toplandığı duyulsun.
6. Kapanış: bunun onu nereye götürdüğü. Bir projeye, bir essay'e yönelen sakin bir son. Soru işaretiyle bitirme.

Ritim ve dil:
- Monoton okumaya uygun: kısa ve orta cümleler, ünlem yok, retorik vurgu yok, soru cümlesi az.
- Her paragraf 2-6 cümle. Paragraflar arasında akış kopmasın.
- Sayı ve saatleri okunacak biçimde yaz ("iki on dört", "on dokuz Eylül").`;

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
          sources: { type: 'ARRAY', items: { type: 'STRING' } },
          cue: { type: 'STRING', nullable: true },
        },
        required: ['text', 'sources'],
      },
    },
    patreonIntro: { type: 'STRING' },
  },
  required: ['title', 'paragraphs', 'patreonIntro'],
};

interface RawDraft {
  title: string;
  paragraphs: { text: string; sources: string[]; cue?: string | null }[];
  patreonIntro: string;
}

interface DraftInput {
  entries: Entry[];
  links: Link[];
  projects: Project[];
  corpus: CorpusDoc | undefined;
  rangeLabel: string;
  styleGuide: string;
  targetWords: number;
  previousTitles: string[];
  cues: boolean;
  lang: Lang;
  apiKey: string;
  model: string;
}

export async function generateAudioLogDraft(input: DraftInput): Promise<AudioLogDraft> {
  const { entries, links, projects, corpus, rangeLabel, styleGuide, targetWords, previousTitles, cues, lang, apiKey, model } = input;
  const chronological = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const aliased = aliasEntries(chronological, { projects, lang, translate: true, maxChars: 1200 });
  const aliasOf = new Map(chronological.map((e, i) => [e.id, `E${i + 1}`]));

  const linkLines = links
    .filter((l) => aliasOf.has(l.fromId) && aliasOf.has(l.toId) && l.state !== 'dismissed')
    .map((l) => `- ${aliasOf.get(l.toId)} → ${aliasOf.get(l.fromId)} (${l.kind === 'contradiction' ? 'gerilim' : 'bağ'}): ${loc(l.rationale, lang)}`)
    .join('\n');

  const instructions = `${SERIES_CONTEXT}

${FORMAT}

Kurallar:
- Fikir içeriği YALNIZCA aşağıdaki girdilerden gelsin. Her girdiyi kullan; hiçbirini atlama.
- Her paragraf en az bir girdiye dayansın; "sources" alanına o paragrafın takma adlarını yaz (E1, E2...).
- Hedef uzunluk: yaklaşık ${targetWords} kelime (±%15).
- ${cues ? 'Yapım işaretleri: gereken yerde "cue" alanına kısa bir not yaz, ör. "oda sesi belirginleşir". Metnin içine köşeli parantez koyma.' : 'Yapım işareti kullanma, "cue" alanını boş bırak.'}
- Uzun tire (—) kullanma. "X değil Y", "X yerine Y", "not X but Y" gibi karşıtlık kalıpları kullanma. "film" kelimesini kullanma; kendi işleri için "essay" de.
- Bu başlıklar daha önce kullanıldı, tekrar etme: ${previousTitles.join(', ') || '(yok)'}.
- patreonIntro: 40-70 kelime, bölümü dışarıdan tanıtan sade bir giriş.
- ${lang === 'tr' ? 'Tamamen Türkçe yaz.' : 'Write entirely in English.'}

Kaydın kapsadığı dönem: ${rangeLabel}

Corpus'un şu anki çekirdeği (yön için, alıntılama):
${corpus ? stripBridges(corpus.core[lang]) : '(yok)'}

Girdiler bağlantıları:
${linkLines || '(yok)'}

Girdiler (kronolojik):
${aliased.block}`;

  const raw = await callGemini<RawDraft>({
    apiKey,
    model,
    systemInstruction: `${PERSONA}\n\nYazım kılavuzu (kesinlikle uy):\n${styleGuide}\n\nÇıktı yalnızca istenen JSON şemasına uygun olmalı.`,
    parts: [{ text: instructions }],
    responseSchema: AUDIOLOG_SCHEMA,
    temperature: 0.75,
  });

  return {
    title: raw.title,
    patreonIntro: raw.patreonIntro,
    paragraphs: raw.paragraphs.map((p) => ({
      text: p.text,
      cue: p.cue || undefined,
      sourceEntryIds: p.sources.map(aliased.resolve).filter((id): id is string => Boolean(id)),
    })),
  };
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
  lang: Lang,
  apiKey: string,
  model: string,
): Promise<Map<number, string>> {
  const block = flagged.map((f) => `- index: ${f.index} | sorunlar: ${f.issues.join('; ')} | metin: ${f.text}`).join('\n');

  const instructions = `Aşağıdaki paragrafları, belirtilen stil sorunlarını gidererek yeniden yaz. İçeriği, anlamı, ritmi ve birinci tekil sesi koru; yalnızca stil ihlallerini düzelt.

Stil kılavuzu:
${styleGuide}

${lang === 'tr' ? 'Türkçe yaz.' : 'Write in English.'}

Paragraflar:
${block}`;

  const result = await callGemini<{ rewrites: { index: number; text: string }[] }>({
    apiKey,
    model,
    systemInstruction: `${PERSONA}\nÇıktı yalnızca istenen JSON şemasına uygun olmalı.`,
    parts: [{ text: instructions }],
    responseSchema: REWRITE_SCHEMA,
  });

  return new Map(result.rewrites.map((r) => [r.index, r.text]));
}
