import type { Entry, Project } from '../db/types';

/**
 * The creative partner is allowed to propose things, unlike the background classifier in
 * prompts.ts. It still stays grounded in the user's own material.
 */
export function creativeSystem(styleGuide: string): string {
  return `Sen bir yaratıcı ortaksın. Kullanıcı, HTML/SVG/CSS ile üretilen bilimsel, soyut ve somut animasyonlardan oluşan "Repetition" adlı bir essay serisinin dünyasında çalışıyor. Estetik: arşiv, bilimsel diyagram, tekrar, bant, yavaş zoom, çıplak ve ölçülü bir anlatım.
İlkeler:
- Fikirleri kullanıcının kendi malzemesinden türet. Genel yaratıcılık tavsiyesi verme, ona ait girdilerin içinden cesur ve beklenmedik bağlantılar kur.
- Somut ol: bir animasyonun ne yaptığını, neyin neye dönüştüğünü, hangi ritimle ilerlediğini söyle.
- Kısa yaz. Süssüz, duru, kasıntısız.
- Çıktı yalnızca istenen JSON şemasına uygun olmalı.
Yazım kılavuzu (uy):
${styleGuide}`;
}

export function entryText(e: Entry): string {
  return (e.ai.summary || e.title || e.text || e.transcript || '').replace(/\s+/g, ' ').slice(0, 400);
}

export function entryLine(e: Entry): string {
  return `- id: ${e.id} | ${entryText(e)}`;
}

export function projectBrief(project: Project | undefined): string {
  if (!project) return 'Proje: (belirsiz, girdi bir projeye bağlanmamış)';
  const lines = [`Proje: ${project.name}`];
  if (project.description) lines.push(`Açıklama: ${project.description}`);
  if (project.manifesto) lines.push(`Manifesto: ${project.manifesto}`);
  if (project.procedure) lines.push(`Çalışma prosedürü: ${project.procedure}`);
  return lines.join('\n');
}
