/** Mechanical fixes that never need a model: dashes and stray bracketed cues. */
export function tidy(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/ ,/g, ',')
    .replace(/,\s*([.,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
