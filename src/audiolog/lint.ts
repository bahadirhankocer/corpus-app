const CONTRAST_PATTERNS_TR = [/\bdeğil\b[^.]{0,40}[,;]/i, /\byerine\b/i, /bırakıp/i];
const CONTRAST_PATTERNS_EN = [/\bnot\b[^.]{0,40}\bbut\b/i, /\binstead of\b/i, /\brather than\b/i];

const YEAR_PAREN = /\(([^)]*\d{4}[^)]*)\)/g;
const HAS_PAGE_REF = /\b(s\.|p\.|sayfa|page)\s*\d+/i;

export function lintParagraphText(text: string, lang: 'tr' | 'en'): string[] {
  const warnings: string[] = [];

  if (text.includes('—')) {
    warnings.push(lang === 'tr' ? 'Uzun tire (—) kullanılmış.' : 'Uses an em dash (—).');
  }

  const contrastPatterns = lang === 'tr' ? CONTRAST_PATTERNS_TR : CONTRAST_PATTERNS_EN;
  if (contrastPatterns.some((p) => p.test(text))) {
    warnings.push(lang === 'tr' ? 'Karşıtlık kalıbı kullanılmış.' : 'Uses a contrast/negation pattern.');
  }

  if (/\bfilm\b/i.test(text)) {
    warnings.push(lang === 'tr' ? '"film" kelimesi kullanılmış.' : 'Uses the word "film".');
  }

  const yearMatches = Array.from(text.matchAll(YEAR_PAREN));
  if (yearMatches.some((m) => !HAS_PAGE_REF.test(m[1]))) {
    warnings.push(lang === 'tr' ? 'Sayfa numarasız yıl ataması var.' : 'Has a year citation without a page number.');
  }

  return warnings;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export interface LintableParagraph {
  text: string;
  sourceEntryIds: string[];
}

export interface LintResult {
  warnings: string[];
  errors: string[];
}

export function lintAudioLogDraft(
  paragraphs: LintableParagraph[],
  lang: 'tr' | 'en',
  targetWords: number,
): LintResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  paragraphs.forEach((p, i) => {
    const label = lang === 'tr' ? `Paragraf ${i + 1}` : `Paragraph ${i + 1}`;
    if (p.sourceEntryIds.length === 0) {
      errors.push(lang === 'tr' ? `${label}: kaynak girdisi yok.` : `${label}: has no source entry.`);
    }
    lintParagraphText(p.text, lang).forEach((w) => warnings.push(`${label}: ${w}`));
  });

  const totalWords = paragraphs.reduce((sum, p) => sum + countWords(p.text), 0);
  if (targetWords > 0) {
    const deviation = Math.abs(totalWords - targetWords) / targetWords;
    if (deviation > 0.15) {
      warnings.push(
        lang === 'tr'
          ? `Kelime sayısı (${totalWords}) hedeften (${targetWords}) %15'ten fazla sapıyor.`
          : `Word count (${totalWords}) deviates more than 15% from target (${targetWords}).`,
      );
    }
  }

  return { warnings, errors };
}
