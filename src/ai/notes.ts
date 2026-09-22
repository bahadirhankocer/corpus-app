import { BILINGUAL, PERSONA, STR, aliasEntries, bi } from './context';
import { callGemini } from './gemini';
import type { Bi, Entry } from '../db/types';

const NOTES_SCHEMA = {
  type: 'OBJECT',
  properties: { notes: { type: 'ARRAY', minItems: 6, maxItems: 10, items: bi(STR) } },
  required: ['notes'],
};

/**
 * A pool of short "I listened" notifications. They quote his own entries back to him, so that after
 * writing he can let go without fearing he will lose anything.
 */
export async function writeListenNotes(entries: Entry[], previous: string[], apiKey: string, model: string): Promise<Bi[]> {
  const aliased = aliasEntries(entries, { maxChars: 300 });
  const instructions = `Ona gün içinde rastgele saatlerde gidecek kısa bildirimler yaz. Amaç: yazdıklarının duyulduğunu, saklandığını ve değerli olduğunu hissetsin; girdi yaptıktan sonra hiçbir şeyi kaçırma korkusu yaşamadan hayatına devam edebilsin.

Kurallar:
- 8 bildirim. Her biri en fazla 22 kelime.
- Karışık ton: çoğu sakin ve sıcak ("Seni dinledim. Daha da dinleyeceğim." ailesinden), bir kısmı zeki ve hafif müstehzi, kuru bir espriyle.
- En az yarısı onun girdilerinden kısa bir alıntı ya da somut bir ayrıntı taşısın (tarih, saat, kelime). Alıntıyı tırnak içinde ver.
- Düşüncesinin neden eşsiz olduğunu söyleyebilirsin ama asla abartılı övgü, motivasyon posteri dili, baskı, görev verme ya da terapi dili yok.
- Hiçbiri diğerinin tekrarı olmasın. Bunlara benzemesin: ${previous.slice(0, 12).join(' | ') || '(yok)'}
- ${BILINGUAL}

Girdiler:
${aliased.block}`;

  const result = await callGemini<{ notes: Bi[] }>({
    apiKey,
    model,
    systemInstruction: `${PERSONA}\nÇıktı yalnızca istenen JSON şemasına uygun olmalı.`,
    parts: [{ text: instructions }],
    responseSchema: NOTES_SCHEMA,
    temperature: 1,
  });
  return result.notes.filter((n) => n.tr?.trim() && n.en?.trim());
}
