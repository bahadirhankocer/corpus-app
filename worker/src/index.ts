/**
 * Push Worker for Corpus.
 *
 * It only knows browser push subscriptions and a daily schedule. It never sees the Gemini key, entries or
 * questions: each push is an empty "wake up" and the app writes the question itself when it opens.
 *
 *   GET  /vapid        public VAPID key (created on first call)
 *   POST /subscribe    { subscription, tzOffsetMin, startHour, endHour, perDay, lang }
 *   POST /unsubscribe  { endpoint }
 *   cron every 10 min  sends the pushes planned for today
 */

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ keys: { name: string }[] }>;
}

interface Env {
  CORPUS_KV: KV;
  ALLOWED_ORIGIN: string;
}

interface Registration {
  subscription: { endpoint: string };
  tzOffsetMin: number;
  startHour: number;
  endHour: number;
  perDay: number;
  lang: string;
}

interface DayPlan {
  minutes: number[];
  sent: number[];
}

const WINDOW_MIN = 30;
const MIN_GAP_MIN = 180;

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface VapidKeys {
  publicKey: string;
  privateJwk: JsonWebKey;
}

async function getVapid(env: Env): Promise<VapidKeys> {
  const stored = await env.CORPUS_KV.get('vapid');
  if (stored) return JSON.parse(stored) as VapidKeys;
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const keys: VapidKeys = {
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateJwk: (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey,
  };
  await env.CORPUS_KV.put('vapid', JSON.stringify(keys));
  return keys;
}

async function vapidHeader(endpoint: string, vapid: VapidKeys): Promise<string> {
  const header = b64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(
    utf8(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: 'mailto:bahadirhankocer@gmail.com',
      }),
    ),
  );
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${vapid.publicKey}`;
}

/** Returns false when the push service says the subscription is gone. */
async function sendPush(endpoint: string, vapid: VapidKeys): Promise<boolean> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(endpoint, vapid),
      TTL: '3600',
      Urgency: 'normal',
      'Content-Length': '0',
    },
  });
  return res.status !== 404 && res.status !== 410;
}

function planDay(reg: Registration): number[] {
  const start = Math.max(0, reg.startHour) * 60;
  const end = Math.min(24, reg.endHour) * 60 - WINDOW_MIN;
  const count = Math.min(Math.max(1, reg.perDay), 3);
  for (let attempt = 0; attempt < 50; attempt++) {
    const picks = Array.from({ length: count }, () => start + Math.floor(Math.random() * Math.max(1, end - start))).sort(
      (a, b) => a - b,
    );
    if (picks.every((m, i) => i === 0 || m - picks[i - 1] >= MIN_GAP_MIN)) return picks;
  }
  return [start + Math.floor((end - start) / 2)];
}

function cors(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  return origin && origin === env.ALLOWED_ORIGIN
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        Vary: 'Origin',
      }
    : {};
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const headers = cors(env, request);
  const { pathname } = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (pathname === '/vapid' && request.method === 'GET') {
    return new Response((await getVapid(env)).publicKey, { headers: { ...headers, 'Content-Type': 'text/plain' } });
  }

  if (pathname === '/subscribe' && request.method === 'POST') {
    const body = (await request.json()) as Registration;
    if (!body?.subscription?.endpoint) return new Response('bad request', { status: 400, headers });
    await env.CORPUS_KV.put(`sub:${await sha256Hex(body.subscription.endpoint)}`, JSON.stringify(body));
    return new Response('ok', { headers });
  }

  if (pathname === '/unsubscribe' && request.method === 'POST') {
    const body = (await request.json()) as { endpoint?: string };
    if (body?.endpoint) await env.CORPUS_KV.delete(`sub:${await sha256Hex(body.endpoint)}`);
    return new Response('ok', { headers });
  }

  return new Response('not found', { status: 404, headers });
}

async function handleScheduled(env: Env): Promise<void> {
  const vapid = await getVapid(env);
  const now = Date.now();
  const { keys } = await env.CORPUS_KV.list({ prefix: 'sub:' });

  for (const { name } of keys) {
    const raw = await env.CORPUS_KV.get(name);
    if (!raw) continue;
    const reg = JSON.parse(raw) as Registration;

    const local = new Date(now + reg.tzOffsetMin * 60_000);
    const day = local.toISOString().slice(0, 10);
    const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
    const planKey = `plan:${name.slice(4)}:${day}`;

    const stored = await env.CORPUS_KV.get(planKey);
    const plan: DayPlan = stored ? (JSON.parse(stored) as DayPlan) : { minutes: planDay(reg), sent: [] };

    for (const minute of plan.minutes) {
      if (plan.sent.includes(minute)) continue;
      if (minuteOfDay < minute || minuteOfDay >= minute + WINDOW_MIN) continue;
      plan.sent.push(minute);
      if (!(await sendPush(reg.subscription.endpoint, vapid))) {
        await env.CORPUS_KV.delete(name);
        break;
      }
    }
    await env.CORPUS_KV.put(planKey, JSON.stringify(plan), { expirationTtl: 2 * 24 * 60 * 60 });
  }
}

export default {
  fetch: handleFetch,
  scheduled: (_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) =>
    ctx.waitUntil(handleScheduled(env)),
};
