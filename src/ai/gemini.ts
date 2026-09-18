import { aiCallMade, aiJobDone, aiJobQueued, aiSetWaiting } from './status';

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
  temperature?: number;
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

// Every Gemini call goes through one gate: calls are serialized and spaced out so the free-tier
// per-minute quota is respected, and a 429 pauses the whole gate instead of failing the job.
const MIN_GAP_MS = 4500;
const MAX_RETRIES = 3;
let chain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
let cooldownUntil = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function gated<T>(fn: () => Promise<T>): Promise<T> {
  aiJobQueued();
  const run = chain.then(async () => {
    try {
      for (let attempt = 0; ; attempt++) {
        const wait = Math.max(lastCallAt + MIN_GAP_MS, cooldownUntil) - Date.now();
        if (wait > 0) {
          if (cooldownUntil > Date.now()) aiSetWaiting(true);
          await sleep(wait);
          aiSetWaiting(false);
        }
        lastCallAt = Date.now();
        aiCallMade();
        try {
          return await fn();
        } catch (err) {
          const transient = err instanceof GeminiRateLimitError || (err instanceof GeminiApiError && /Gemini API 5\d\d/.test(err.message));
          if (!transient || attempt >= MAX_RETRIES) throw err;
          cooldownUntil = Date.now() + 15000 * 2 ** attempt;
        }
      }
    } finally {
      aiJobDone();
    }
  });
  chain = run.catch(() => undefined);
  return run;
}

export async function callGemini<T>(req: GeminiRequest): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${req.apiKey}`;

  const doCall = (): Promise<string> =>
    gated(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.systemInstruction }] },
          contents: [{ role: 'user', parts: req.parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: req.responseSchema,
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
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
    });

  const text = await doCall();
  try {
    return JSON.parse(text) as T;
  } catch {
    // one retry on parse failure, per spec
    const retryText = await doCall();
    return JSON.parse(retryText) as T;
  }
}
