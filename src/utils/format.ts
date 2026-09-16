export function formatDateTime(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
