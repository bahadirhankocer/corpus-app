export class GeminiRateLimitError extends Error {}

export class GeminiApiError extends Error {}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiRequest {
  apiKey: string;
  model: string;
  systemInstruction: string;
  parts: GeminiPart[];
  responseSchema: unknown;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function callGemini<T>(req: GeminiRequest): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${req.apiKey}`;

  const doCall = async (): Promise<string> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemInstruction }] },
        contents: [{ role: 'user', parts: req.parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: req.responseSchema,
        },
      }),
    });

    if (res.status === 429) {
      throw new GeminiRateLimitError('rate limited');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new GeminiApiError(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new GeminiApiError('Gemini API: empty response');
    }
    return text;
  };

  const text = await doCall();
  try {
    return JSON.parse(text) as T;
  } catch {
    // one retry on parse failure, per spec
    const retryText = await doCall();
    return JSON.parse(retryText) as T;
  }
}
