import { BILINGUAL, STR, aliasEntries, bi, creativeSystem } from './context';
import { callGemini } from './gemini';
import type { Bi, CorpusBridge, CorpusDoc, Entry, Project } from '../db/types';

const BI = bi(STR);

const CORPUS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: BI,
    core: BI,
    direction: BI,
    sections: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 6,
      items: {
        type: 'OBJECT',
        properties: { heading: BI, body: BI },
        required: ['heading', 'body'],
      },
    },
    bridges: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: STR,
          term: BI,
          why: BI,
          entries: { type: 'ARRAY', items: STR },
        },
        required: ['id', 'term', 'why', 'entries'],
      },
    },
    delta: BI,
    morning: BI,
  },
  required: ['title', 'core', 'direction', 'sections', 'bridges', 'delta', 'morning'],
};

type RawCorpus = Omit<CorpusDoc, 'id' | 'createdAt' | 'sourceSig' | 'entryCount' | 'bridges'> & {
  bridges: { id: string; term: Bi; why: Bi; entries: string[] }[];
};

export type CorpusDraft = Omit<CorpusDoc, 'id' | 'createdAt' | 'sourceSig' | 'entryCount'>;

interface CorpusInput {
  entries: Entry[];
  projects: Project[];
  previous: CorpusDoc | undefined;
  /** entries added since the previous version, for `delta` */
  newEntryIds: string[];
  styleGuide: string;
  apiKey: string;
  model: string;
}

const BRIDGE = /\[\[([A-Za-z0-9_-]+)\|([^\]]+)\]\]/g;

function previousBlock(previous: CorpusDoc | undefined): string {
  if (!previous) return '(henüz yok, ilk kez yazıyorsun)';
  const sections = previous.sections.map((s) => `## ${s.heading.tr}\n${s.body.tr.replace(BRIDGE, '$2')}`).join('\n\n');
  return `# ${previous.title.tr}\n${previous.core.tr.replace(BRIDGE, '$2')}\n\n${sections}`;
}

/**
 * Writes the next version of the corpus: one linear text that reads all entries as a single body of
 * thought and pushes it toward the next essay.
 */
export async function writeCorpus(input: CorpusInput): Promise<CorpusDraft> {
  const { entries, projects, previous, newEntryIds, styleGuide, apiKey, model } = input;
  const chronological = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const aliased = aliasEntries(chronological, { projects, maxChars: 900 });
  const newAliases = chronological
    .map((e, i) => (newEntryIds.includes(e.id) ? `E${i + 1}` : null))
    .filter(Boolean)
    .join(', ');

  const instructions = `Aşağıda onun Corpus'undaki tüm girdiler var, kronolojik sırayla. Bunlar bilinçdışından gelen, birbirinden bağımsız görünen notlar. Senin işin, bu notların istemsizce oluşturduğu düşünce bütününü görünür kılmak: onu okuyan kişi kafasını toplasın, sakinleşsin ve kendini bir sonraki essay'e doğru çekilmiş hissetsin.

Corpus'un önceki hali:
${previousBlock(previous)}

Önceki halden sonra eklenen girdiler: ${newAliases || '(yok)'}

Yeni versiyonu yaz. Sıfırdan yazma; önceki hali ciddiye al, yeni girdiler neyi değiştiriyorsa onu değiştir, gerisini koru ve derinleştir. Metin her versiyonda daha solid ve daha lineer olsun.

Alanlar:
- title: bu düşünce bütününün çalışma başlığı. Kısa, tek kavram ya da kısa bir ifade.
- core: çekirdek paragraf. 70-120 kelime. "Şu ana kadar düşünülenler"in en yoğun hali: ne düşünülüyor, hangi eksenler birleşiyor, nereye gidiyor. Onu karşılayan ilk şey bu; dingin ve net olsun.
- sections: 2-6 bölüm. Her bölüm bir eksen: hangi girdiler birbirine yakın, nasıl bağlanıyor, birbirine nasıl entegre edilebilir. Bunu düşünsel, bilimsel ve felsefi olarak tartış (kavramlar, mekanizmalar, referans alanları). Her body 80-160 kelime, akıcı düzyazı, madde işareti yok. Bölümler birbirine bağlansın; baştan sona tek bir lineer akış olarak okunsun.
- direction: 1-2 cümle. Bu akış hangi essay'e doğru gidiyor.
- bridges: metindeki köprü kavramlar. core ve section body içinde önemli kelime ya da kısa ifadeleri [[b1|görünen metin]] biçiminde işaretle (id: b1, b2, ...). Her iki dilde aynı id'ler kullanılsın. Toplam 4-12 köprü; her paragrafta en fazla 3. Her köprü için:
  · term: kavramın adı,
  · why: 1-2 cümle, bunu neden düşündüğün, hangi girdilerin bunu doğurduğu,
  · entries: bu köprüyü doğuran girdilerin takma adları (E1, E2...).
- delta: 1-2 cümle, yeni girdilerin corpus'ta neyi değiştirdiği. Bir bildirim olarak okunacak; ona hitap et ("Dün gece yazdığın ..."). Yeni girdi yoksa genel bir cümle.
- morning: yarın sabah okuyacağı tek kısa paragraf (en fazla 45 kelime): dün nerede kalındı, bugün nereden devam edilebilir. Baskı kurma, davet et.

${BILINGUAL} Başlıklar da iki dilde olsun.

Girdiler:
${aliased.block}`;

  const raw = await callGemini<RawCorpus>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: CORPUS_SCHEMA,
    temperature: 0.7,
  });

  const bridges: CorpusBridge[] = raw.bridges.map((b) => ({
    id: b.id,
    term: b.term,
    why: b.why,
    entryIds: b.entries.map(aliased.resolve).filter((id): id is string => Boolean(id)),
  }));
  return { ...raw, bridges };
}

export interface BridgeSegment {
  text: string;
  bridgeId?: string;
}

/** Splits a corpus paragraph into plain text and bridge terms. Unknown bridge ids become plain text. */
export function parseBridges(text: string, known: Set<string>): BridgeSegment[] {
  const out: BridgeSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(BRIDGE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(known.has(m[1]) ? { text: m[2], bridgeId: m[1] } : { text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function stripBridges(text: string): string {
  return text.replace(BRIDGE, '$2');
}
