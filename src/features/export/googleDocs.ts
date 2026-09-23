import { useSyncExternalStore } from 'react';

import { GOOGLE_CLIENT_ID } from '../../config';
import { db } from '../../db/db';
import type { AudioLog, Lang } from '../../db/types';
import { audioLogView } from '../../i18n/localize';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'corpus.googleToken';
const PENDING_KEY = 'corpus.googlePending';
const FOLDER_NAME = 'Corpus';
const DOC_MIME = 'application/vnd.google-apps.document';

export type DocsStatus =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'done'; url: string }
  | { state: 'copied' }
  | { state: 'error' };

let status: DocsStatus = { state: 'idle' };
const listeners = new Set<() => void>();

function setStatus(next: DocsStatus): void {
  status = next;
  listeners.forEach((l) => l());
}

export function useDocsStatus(): DocsStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

export function dismissDocsStatus(): void {
  setStatus({ state: 'idle' });
}

export interface PendingDocsSave {
  state: string;
  logId: string;
  lang: Lang;
}

class AuthError extends Error {}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the next save signs in again
  }
}

function storedToken(): string | null {
  const token = read<{ value: string; expiresAt: number }>(TOKEN_KEY);
  return token && token.expiresAt - 60_000 > Date.now() ? token.value : null;
}

function redirectUri(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

/** Leaves for Google's consent page; the app comes back to the same address with a token in the hash. */
function signIn(logId: string, lang: Lang): void {
  const state = crypto.randomUUID();
  write(PENDING_KEY, { state, logId, lang } satisfies PendingDocsSave);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * Reads the token Google put in the hash after sign-in. Runs once at startup, before anything else looks
 * at the hash, and wipes it from the address bar.
 */
export function consumeGoogleRedirect(): PendingDocsSave | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const state = params.get('state');
  if (!state) return null;
  const pending = read<PendingDocsSave>(PENDING_KEY);
  if (!pending || pending.state !== state) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  write(PENDING_KEY, null);
  const token = params.get('access_token');
  if (!token) return null;
  write(TOKEN_KEY, { value: token, expiresAt: Date.now() + Number(params.get('expires_in') || 3600) * 1000 });
  resumable = pending;
  return pending;
}

let resumable: PendingDocsSave | null = null;

/** Finishes the save that was waiting for sign-in. */
export function resumeDocsSave(patreonLabel: string): void {
  const pending = resumable;
  resumable = null;
  if (pending) void saveAudioLogToDocs(pending.logId, pending.lang, patreonLabel, false);
}

async function drive<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`drive ${res.status}`);
  return (await res.json()) as T;
}

async function folderId(token: string): Promise<string> {
  const q = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await drive<{ files: { id: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
  );
  if (found.files[0]) return found.files[0].id;
  const created = await drive<{ id: string }>(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return created.id;
}

function multipart(metadata: object, html: string): { body: string; type: string } {
  const boundary = `corpus${crypto.randomUUID().replace(/-/g, '')}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return { body, type: `multipart/related; boundary=${boundary}` };
}

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/** Converts the HTML into a Google Doc, or replaces the content of the one saved before. */
async function upload(token: string, name: string, html: string, existingId?: string): Promise<string> {
  if (existingId) {
    const { body, type } = multipart({ name }, html);
    const res = await fetch(`${UPLOAD_URL}/${existingId}?uploadType=multipart&fields=id`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
      body,
    });
    if (res.ok) return existingId;
    if (res.status === 401) throw new AuthError();
    // deleted or no longer reachable: a new document is made below
  }
  const { body, type } = multipart({ name, mimeType: DOC_MIME, parents: [await folderId(token)] }, html);
  const created = await drive<{ id: string }>(token, `${UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': type },
    body,
  });
  return created.id;
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function audioLogHtml(log: AudioLog, lang: Lang, patreonLabel: string): { name: string; html: string; text: string } {
  const view = audioLogView(log, lang);
  const number = String(log.number).padStart(3, '0');
  const serif = 'font-family:Georgia,serif;font-size:13pt;line-height:1.6';
  const muted = 'font-family:Arial,sans-serif;font-size:9pt;letter-spacing:1px;color:#888888';
  const name = `AUDIO LOG ${number} — ${view.title}`;
  const body = view.paragraphs
    .map(
      (p) =>
        `<p style="${serif}">${escape(p.text)}</p>` +
        (p.cue ? `<p style="${muted};font-style:italic">[${escape(p.cue)}]</p>` : ''),
    )
    .join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(name)}</title></head><body>
<p style="${muted}">AUDIO LOG ${number}</p>
<h1 style="font-family:Arial,sans-serif;font-weight:300;font-size:26pt;letter-spacing:1px">${escape(view.title)}</h1>
${body}
<hr>
<p style="${muted}">${escape(patreonLabel.toUpperCase())}</p>
<p style="${serif}">${escape(view.patreonIntro)}</p>
</body></html>`;
  const text = [name, ...view.paragraphs.map((p) => p.text), patreonLabel.toUpperCase(), view.patreonIntro].join('\n\n');
  return { name, html, text };
}

/** Fallback while no OAuth client is configured: formatted text on the clipboard and a blank Doc. */
async function copyAndOpen(html: string, text: string): Promise<void> {
  const opened = window.open('https://docs.new', '_blank');
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(text);
  }
  setStatus(opened ? { state: 'copied' } : { state: 'error' });
}

/**
 * Saves an Audio Log as a Google Doc in a "Corpus" folder. The first time, and whenever the hour-long token
 * has expired, the app leaves for Google's consent page and finishes the save when it comes back.
 */
export async function saveAudioLogToDocs(logId: string, lang: Lang, patreonLabel: string, interactive = true): Promise<void> {
  const log = await db.audioLogs.get(logId);
  if (!log) return;
  const { name, html, text } = audioLogHtml(log, lang, patreonLabel);

  if (!GOOGLE_CLIENT_ID) {
    await copyAndOpen(html, text);
    return;
  }

  const token = storedToken();
  if (!token) {
    if (interactive) signIn(logId, lang);
    else setStatus({ state: 'error' });
    return;
  }

  setStatus({ state: 'working' });
  try {
    const id = await upload(token, name, html, log.docs?.[lang]);
    await db.audioLogs.update(logId, { docs: { ...log.docs, [lang]: id } });
    setStatus({ state: 'done', url: `https://docs.google.com/document/d/${id}/edit` });
  } catch (err) {
    if (err instanceof AuthError && interactive) {
      write(TOKEN_KEY, null);
      signIn(logId, lang);
      return;
    }
    setStatus({ state: 'error' });
  }
}
