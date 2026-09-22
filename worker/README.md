# Corpus push Worker

A tiny Cloudflare Worker that wakes the phone at random hours of the day. It stores only the browser's push subscription, the active hours and a few wake-up times. It never sees the Gemini key, the entries or any notification text: every push is empty, and the phone chooses what to show from notes the app prepared.

The free tier is enough. One-time setup:

```bash
cd worker
npx wrangler login                        # opens the browser; allow access to your Cloudflare account
npx wrangler kv namespace create CORPUS_KV
```

Copy the `id` from the output into `wrangler.toml` (`REPLACE_WITH_KV_NAMESPACE_ID`), then:

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL, for example `https://corpus-push.<your-subdomain>.workers.dev`. Put it in `src/config.ts` (`DEFAULT_PUSH_WORKER_URL`); it is public and safe to commit. Alternatively, pass it once through a setup link:

```
https://bahadirhankocer.github.io/corpus/#w=https://corpus-push.<your-subdomain>.workers.dev
```

Then turn on Settings → Notifications and send a test notification.

To change who may call the Worker from a browser, edit `ALLOWED_ORIGIN` in `wrangler.toml`.
