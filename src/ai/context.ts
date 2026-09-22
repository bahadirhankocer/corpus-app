import { effectiveProjectId } from '../db/effective';
import type { Entry, Lang, Project } from '../db/types';
import { entryOriginal, loc } from '../i18n/localize';

/** Who the app serves and why. Every creative prompt starts from here. */
export const PERSONA = `Kullanıcı: Bahadırhan Koçer. Hayatını YouTube'da yayımladığı video essay'lerden kazanan bir yaratıcı. Her essay yaklaşık altı ay süren, çok katmanlı bir üretim. Son işi "Repetition": HTML/SVG/CSS ile üretilmiş bilimsel, soyut ve somut animasyonlardan kurulu bir arşiv estetiği (bant, tekrar, yavaş geri zoom, ölçek çizgileri, çıplak ve ölçülü anlatım).
Şu an yoğun bir üretimin ve bir taşınmanın ardından boşlukta, zihinsel olarak kırılgan bir dönemden geçiyor. Düşünceleri ansızın, dağınık, bazen alakasız ama sezgisel olarak heyecan verici biçimde geliyor; çoğu zaman yatakta, gece.
Bu uygulamanın adı Corpus. Görevi o dağınık, spontane girdileri lineer, düzenli ve bir sonraki essay'e doğru ilerleyen bir bütüne dönüştürmek. Bir ayın sonunda senaryo, brief, animasyon temaları, yan fikirler ve bağlantılar zaten düşünülmüş ve derlenmiş olmalı.`;

export const TONE = `Ton: sakin, zeki, saygılı ve sıcak. Onun düşüncelerini ciddiye al. Asla baskı kurma, üretkenlik talep etme, suçluluk hissettirme, terapi dili kullanma ya da teşhis koyma.`;

export const BILINGUAL = `İki dilde yaz: "tr" alanı Türkçe, "en" alanı İngilizce. İki sürüm aynı içeriği taşısın ve kendi dilinde doğal okunsun.`;

export function creativeSystem(styleGuide: string): string {
  return `${PERSONA}

${TONE}

Senin rolün: onun yaratıcı ortağı. Fikirleri onun kendi malzemesinden türet, girdilerin içinden cesur ve beklenmedik bağlantılar kur. Genel yaratıcılık tavsiyesi verme. Somut ol: bir animasyonun ne yaptığını, neyin neye dönüştüğünü, hangi ritimle ilerlediğini söyle.
Çıktı yalnızca istenen JSON şemasına uygun olmalı.

Yazım kılavuzu (uy):
${styleGuide}`;
}

export const STR = { type: 'STRING' } as const;

export function bi(schema: unknown): unknown {
  return { type: 'OBJECT', properties: { tr: schema, en: schema }, required: ['tr', 'en'] };
}

const LOCALE: Record<Lang, string> = { tr: 'tr-TR', en: 'en-GB' };

export function stamp(iso: string, lang: Lang = 'tr'): string {
  return new Date(iso).toLocaleString(LOCALE[lang], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface Aliased {
  block: string;
  resolve: (alias: string) => string | undefined;
}

interface AliasOptions {
  projects?: Project[];
  /** language used for dates, and for translated text when a translation exists */
  lang?: Lang;
  /** prefer the translation into `lang` over the original */
  translate?: boolean;
  maxChars?: number;
}

/**
 * Entries as a compact block with short aliases (E1, E2, ...). Models copy short aliases back far more
 * reliably than UUIDs; `resolve` maps them back.
 */
export function aliasEntries(entries: Entry[], options: AliasOptions = {}): Aliased {
  const { projects = [], lang = 'tr', translate = false, maxChars = 700 } = options;
  const map = new Map<string, string>();
  const lines = entries.map((e, i) => {
    const alias = `E${i + 1}`;
    map.set(alias, e.id);
    const project = projects.find((p) => p.id === effectiveProjectId(e))?.name;
    const translated = translate && e.lang && e.lang !== lang ? e.i18n?.[lang] : undefined;
    const text = (translated?.text || entryOriginal(e)).replace(/\s+/g, ' ').slice(0, maxChars);
    const title = translated?.title || e.title;
    const head = [`[${alias}]`, stamp(e.createdAt, lang), project].filter(Boolean).join(' · ');
    const parts = [head];
    if (e.promptQuestion) parts.push(`  (AI'ın sorusuna cevap: ${loc(e.promptQuestion, lang)})`);
    if (title) parts.push(`  başlık: ${title}`);
    parts.push(`  "${text}"`);
    if (e.context) parts.push(`  bağlam: ${e.context}`);
    (e.thread ?? []).forEach((t, j) => {
      const answer =
        typeof t.answer === 'string' ? (translate && translated?.thread?.[j]) || t.answer : loc(t.answer, lang);
      parts.push(`  ↳ ${stamp(t.at, lang)} AI sordu: ${loc(t.question, lang)} / o cevapladı: ${answer}`);
    });
    return parts.join('\n');
  });
  return {
    block: lines.join('\n'),
    resolve: (alias) => map.get(alias.trim().replace(/^\[|\]$/g, '')),
  };
}

export function projectBrief(project: Project | undefined, lang: Lang = 'tr'): string {
  if (!project) return 'Proje: (belirsiz)';
  const lines = [`Proje: ${project.name}`];
  if (project.description) lines.push(`Açıklama: ${project.description}`);
  if (project.manifesto) lines.push(`Manifesto: ${loc(project.manifesto, lang)}`);
  if (project.procedure) lines.push(`Çalışma prosedürü: ${loc(project.procedure, lang)}`);
  return lines.join('\n');
}
