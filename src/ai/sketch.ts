import { creativeSystem } from './context';
import { callGemini } from './gemini';
import type { DossierTheme } from '../db/types';

const SKETCH_SCHEMA = {
  type: 'OBJECT',
  properties: { html: { type: 'STRING' } },
  required: ['html'],
};

/** A small, self-contained, looping HTML/SVG animation that makes a theme visible. */
export async function writeSketch(theme: DossierTheme, styleGuide: string, apiKey: string, model: string): Promise<string> {
  const instructions = `Aşağıdaki animasyon teması için çalışan bir HTML eskizi yaz.

Tema: ${theme.name.tr}
Tarif: ${theme.description.tr}

Teknik kurallar:
- Tek, bağımsız bir HTML belgesi: <!doctype html> ile başlasın, tüm CSS ve JS içinde olsun.
- Hiçbir dış kaynak yok: font, resim, kütüphane, ağ isteği yok.
- Tam ekran, arka plan saf siyah (#000), çizgiler ve şekiller beyaz ya da gri tonlarında, ince (0.5-1.5px).
- Estetik: bilimsel diyagram, arşiv, ölçek çizgileri, tekrar, yavaş ve ölçülü hareket. Renk yok (en fazla tek bir soluk vurgu).
- 8-20 saniyelik kesintisiz bir döngü. SVG + CSS animasyonu ya da canvas + requestAnimationFrame.
- Ekranın boyutuna uyum sağlasın (dikey telefon ve yatay ekran).
- Metin kullanma; gerekirse en fazla bir iki küçük mono etiket.
- Toplam en fazla 14000 karakter.`;

  const result = await callGemini<{ html: string }>({
    apiKey,
    model,
    systemInstruction: creativeSystem(styleGuide),
    parts: [{ text: instructions }],
    responseSchema: SKETCH_SCHEMA,
    temperature: 0.9,
  });
  return result.html;
}
