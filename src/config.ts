/**
 * Public URL of the push Worker (see worker/README.md). This is not a secret; it can be committed.
 * It can be overridden from a setup link (`#w=`).
 */
export const DEFAULT_PUSH_WORKER_URL = 'https://corpus-push.bahadirhankocer.workers.dev';

/**
 * OAuth client for saving Audio Logs to Google Docs (scope: drive.file, only files the app creates).
 * A web client ID is public by design; it can be committed. Empty means the text is copied and a blank
 * document is opened instead.
 */
export const GOOGLE_CLIENT_ID = '';
