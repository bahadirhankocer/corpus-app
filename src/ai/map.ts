import { BILINGUAL, STR, aliasEntries, bi, creativeSystem } from './context';
import { stripBridges } from './corpus';
import { callGemini } from './gemini';
import type { Bi, CorpusDoc, Entry, Project, SequenceMap } from '../db/types';
import { upper } from '../i18n/localize';

const BI = bi(STR);
export const MAP_COLS = 4;
export const MAP_ROWS = 8;

const MAP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clusters: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 9,
      items: {
        type: 'OBJECT',
        properties: {
          name: BI,
          col: { type: 'INTEGER' },
          row: { type: 'INTEGER' },
          entries: { type: 'ARRAY', items: STR },
        },
        required: ['name', 'col', 'row', 'entries'],
      },
    },
    headlines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { entry: STR, text: BI },
        required: ['entry', 'text'],
      },
    },
    bonds: {
      type: 'ARRAY',
      maxItems: 14,
      items: {
        type: 'OBJECT',
        properties: { from: { type: 'INTEGER' }, to: { type: 'INTEGER' }, why: BI },
        required: ['from', 'to', 'why'],
      },
    },
  },
  required: ['clusters', 'headlines', 'bonds'],
};

interface RawMap {
  clusters: { name: Bi; col: number; row: number; entries: string[] }[];
  headlines: { entry: string; text: Bi }[];
  bonds: { from: number; to: number; why: Bi }[];
}

export type MapDraft = Omit<SequenceMap, 'id' | 'createdAt' | 'sourceSig' | 'entryCount'>;

interface MapInput {
  entries: Entry[];
  projects: Project[];
  corpus: CorpusDoc | undefined;
  previous: SequenceMap | undefined;
  styleGuide: string;
  apiKey: string;
  model: string;
}

const upperBi = (b: Bi): Bi => ({ tr: upper(b.tr.trim()), en: upper(b.en.trim()) });

/** Two clusters never share a matrix point: a collision moves to the nearest free one. */
function settle(clusters: { col: number; row: number }[]): void {
  const taken = new Set<string>();
  for (const c of clusters) {
    c.col = Math.min(MAP_COLS - 1, Math.max(0, Math.round(c.col)));
    c.row = Math.min(MAP_ROWS - 1, Math.max(0, Math.round(c.row)));
    if (taken.has(`${c.col},${c.row}`)) {
      let best: { col: number; row: number; d: number } | undefined;
      for (let col = 0; col < MAP_COLS; col++) {
        for (let row = 0; row < MAP_ROWS; row++) {
          if (taken.has(`${col},${row}`)) continue;
          const d = Math.hypot(col - c.col, row - c.row);
          if (!best || d < best.d) best = { col, row, d };
        }
      }
      if (best) Object.assign(c, { col: best.col, row: best.row });
    }
    taken.add(`${c.col},${c.row}`);
  }
}

/**
 * The corpus as a sequence map: numbered clusters on a matrix, each a stack of short uppercase headlines,
 * with organic ties between clusters. Placement carries meaning: neighbours belong together.
 */
export async function drawMap(input: MapInput): Promise<MapDraft> {
  const { entries, projects, corpus, previous, styleGuide, apiKey, model } = input;
  const chronological = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const aliased = aliasEntries(chronological, { projects, maxChars: 320 });

  const previousBlock = previous
    ? previous.clusters
        .map((c, i) => `${String(i + 1).padStart(2, '0')} ${c.name.tr} @ (${c.col}, ${c.row})`)
        .join('\n')
    : '';

  const instructions = `Tüm girdilerden bir sekans haritası çiz. Harita ${MAP_COLS} sütun × ${MAP_ROWS} satırlık bir matris. Kümeler matrisin noktalarına oturur ve 01, 02, 03 diye numaralanır.

Alanlar:
- clusters: 3-9 küme (girdi azsa daha az). Her küme bir sekans: birlikte düşünülmüş, aynı damardan gelen girdiler.
  - name: 1-3 kelimelik, büyük harf, kavram gibi bir ad.
  - col (0-${MAP_COLS - 1}), row (0-${MAP_ROWS - 1}): matris noktası. Yerleşim anlam taşısın: birbirini besleyen kümeler komşu olsun, gerilim içindekiler karşılıklı dursun. Matris dikey okunur: akış yukarıdan aşağı iner, aynı satırda yan yana duran kümeler aynı anın farklı yüzleridir. Hepsini tek sütuna dizme; iki boyutu da kullan. İki küme aynı noktada olmasın.
  - Sıra, bir sonraki essay'in akış sırası olsun: 01 açılış, son küme kapanış.
  - entries: kümeye ait girdilerin takma adları (E1, E2...). Her girdi tam olarak bir kümede olsun; hiçbirini dışarıda bırakma.
- headlines: HER girdi için bir başlık. 1-4 kelime, büyük harf, somut bir imge ya da onun kendi kelimeleri. Açıklama cümlesi kurma.
- bonds: kümeler arası organik bağlar (en fazla 14). from ve to küme numaraları (1'den başlar). why: bağın nedenini söyleyen 3-8 kelime.

${previous ? `Önceki harita (numaralar ve noktalar). Yeni girdiler gerektirmedikçe adları ve noktaları koru, harita zamanla büyüsün:\n${previousBlock}` : ''}

${BILINGUAL}

Corpus'un çekirdeği (yön için):
${corpus ? `${corpus.title.tr}\n${stripBridges(corpus.core.tr)}` : '(henüz yok)'}

Girdiler:
${aliased.block}`;

  const raw = await callGemini<RawMap>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: MAP_SCHEMA,
    temperature: 0.6,
  });

  const seen = new Set<string>();
  const drawn = raw.clusters.map((c) => ({
    name: upperBi(c.name),
    col: c.col,
    row: c.row,
    entryIds: c.entries.map(aliased.resolve).filter((id): id is string => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  }));
  // Empty clusters are dropped, so bond numbers are mapped onto the clusters that remain.
  const newIndex = new Map<number, number>();
  const clusters = drawn.filter((c, i) => {
    if (c.entryIds.length === 0) return false;
    newIndex.set(i, newIndex.size);
    return true;
  });
  settle(clusters);

  const headlines: Record<string, Bi> = {};
  for (const h of raw.headlines) {
    const id = aliased.resolve(h.entry);
    if (id) headlines[id] = upperBi(h.text);
  }

  const bonds = raw.bonds
    .map((b) => ({ from: newIndex.get(b.from - 1) ?? -1, to: newIndex.get(b.to - 1) ?? -1, why: b.why }))
    .filter((b) => b.from >= 0 && b.to >= 0 && b.from !== b.to);

  return { clusters, headlines, bonds };
}
