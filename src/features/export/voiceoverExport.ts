import { effectiveCategories } from '../../db/effective';
import type { Entry, Project, Sequence } from '../../db/types';
import { downloadTextFile } from '../../utils/download';

function entryText(entry: Entry): string {
  return entry.text || entry.transcript || '';
}

function entryPreview(entry: Entry): string {
  return entry.title || entryText(entry) || entry.ai.summary || '';
}

export function buildVoiceoverScript(project: Project, entries: Entry[], sequence: Sequence | undefined): string {
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const lines: string[] = [`# ${project.name} — Voiceover`, ''];

  const sections = sequence?.sections ?? [
    { id: 'all', label: project.name, entryIds: entries.map((e) => e.id), note: undefined },
  ];

  for (const section of sections) {
    const sectionEntries = section.entryIds.map((id) => entryMap.get(id)).filter((e): e is Entry => !!e);
    const voiceoverEntries = sectionEntries.filter((e) => effectiveCategories(e).includes('voiceover'));
    if (voiceoverEntries.length === 0) continue;

    const related = sectionEntries.filter((e) => {
      const cats = effectiveCategories(e);
      return cats.includes('sound') || cats.includes('scene');
    });

    lines.push(`## ${section.label}`, '');
    for (const e of voiceoverEntries) {
      lines.push(entryText(e) || entryPreview(e));
      if (related.length > 0) {
        lines.push(`*${related.map((r) => entryPreview(r)).join(' · ')}*`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function exportVoiceoverScript(project: Project, entries: Entry[], sequence: Sequence | undefined): void {
  const content = buildVoiceoverScript(project, entries, sequence);
  const safeName = project.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
  downloadTextFile(`voiceover-${safeName}.md`, content, 'text/markdown');
  downloadTextFile(`voiceover-${safeName}.txt`, content, 'text/plain');
}
