import { BILINGUAL, STR, aliasEntries, bi, creativeSystem } from './context';
import { stripBridges } from './corpus';
import { callGemini } from './gemini';
import type { Bi, CorpusDoc, Dossier, Entry, Project } from '../db/types';

const BI = bi(STR);

const DOSSIER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    candidate: {
      type: 'OBJECT',
      properties: { title: BI, logline: BI, structure: BI },
      required: ['title', 'logline', 'structure'],
    },
    brief: BI,
    scenario: BI,
    themes: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 6,
      items: {
        type: 'OBJECT',
        properties: { name: BI, description: BI, entries: { type: 'ARRAY', items: STR } },
        required: ['name', 'description', 'entries'],
      },
    },
    sideIdeas: {
      type: 'ARRAY',
      maxItems: 6,
      items: {
        type: 'OBJECT',
        properties: { text: BI, entries: { type: 'ARRAY', items: STR } },
        required: ['text', 'entries'],
      },
    },
  },
  required: ['candidate', 'brief', 'scenario', 'themes', 'sideIdeas'],
};

interface RawDossier {
  candidate: Dossier['candidate'];
  brief: Bi;
  scenario: Bi;
  themes: { name: Bi; description: Bi; entries: string[] }[];
  sideIdeas: { text: Bi; entries: string[] }[];
}

export type DossierDraft = Omit<Dossier, 'id' | 'createdAt' | 'entryCount'>;

interface DossierInput {
  corpus: CorpusDoc;
  entries: Entry[];
  projects: Project[];
  previous: Dossier | undefined;
  styleGuide: string;
  apiKey: string;
  model: string;
}

export function themeKey(name: Bi): string {
  return name.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || name.tr.toLowerCase();
}

/** The production material the corpus is leading to. */
export async function writeDossier(input: DossierInput): Promise<DossierDraft> {
  const { corpus, entries, projects, previous, styleGuide, apiKey, model } = input;
  const chronological = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const aliased = aliasEntries(chronological, { projects, maxChars: 400 });

  const corpusText = [
    `# ${corpus.title.tr}`,
    stripBridges(corpus.core.tr),
    ...corpus.sections.map((s) => `## ${s.heading.tr}\n${stripBridges(s.body.tr)}`),
    `Yön: ${corpus.direction.tr}`,
  ].join('\n\n');

  const instructions = `Corpus'un şu anki hali ve tüm girdiler aşağıda. Bu malzemeden bir sonraki essay için üretim dosyasını hazırla. Bir ayın sonunda açıldığında "zaten düşünülmüş" olmalı.

Alanlar:
- candidate: video adayı. title (çalışma başlığı), logline (tek cümle), structure (3-6 bölümlük yapı, her bölüm bir satır, "1. ..." biçiminde).
- brief: 120-200 kelimelik yapım brief'i: konu, ton, biçim, görsel dil, ses, neyden kaçınılacak.
- scenario: 150-300 kelimelik senaryo akışı: açılıştan kapanışa sahneler ve geçişler, düzyazı.
- themes: 2-6 HTML animasyon teması. Repetition estetiğinde (siyah zemin, ince çizgiler, bilimsel diyagram, tekrar, yavaş hareket). name kısa; description 2-3 cümle: ekranda tam olarak ne oluyor, neyin neye dönüştüğü, ritim. entries: temayı doğuran girdiler.
- sideIdeas: essay'e girmeyen ama değerli yan fikirler (en fazla 6), her biri 1-2 cümle.

${previous ? `Önceki dosyanın video adayı: ${previous.candidate.title.tr} (${previous.candidate.logline.tr}). Gerekmedikçe değiştirme, olgunlaştır.` : ''}

${BILINGUAL}

Corpus:
${corpusText}

Girdiler:
${aliased.block}`;

  const raw = await callGemini<RawDossier>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: DOSSIER_SCHEMA,
    temperature: 0.8,
  });

  const resolve = (aliases: string[]) => aliases.map(aliased.resolve).filter((id): id is string => Boolean(id));
  return {
    candidate: raw.candidate,
    brief: raw.brief,
    scenario: raw.scenario,
    themes: raw.themes.map((t) => ({ key: themeKey(t.name), name: t.name, description: t.description, entryIds: resolve(t.entries) })),
    sideIdeas: raw.sideIdeas.map((s) => ({ text: s.text, entryIds: resolve(s.entries) })),
  };
}
