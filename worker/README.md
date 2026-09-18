# Corpus push Worker

A tiny Cloudflare Worker that wakes the app at random hours of the day, so it can bring you a question.
It stores only your browser's push subscription and today's schedule. It never sees the Gemini key, your
entries or the questions: each push is empty, and the app writes the question itself when it opens.

The free tier is enough. One-time setup, about ten minutes:

```bash
cd worker
npx wrangler login                      # opens the browser; sign in to (or create) a Cloudflare account
npx wrangler kv namespace create CORPUS_KV
```

Copy the `id` from the output into `wrangler.toml` (`REPLACE_WITH_KV_NAMESPACE_ID`), then:

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL, for example `https://corpus-push.<your-subdomain>.workers.dev`.

Give it to the app once by opening this link on your phone. The same link can also carry the Gemini key
(`#k=<key>&w=<worker url>`, see the main README):

```
https://bahadirhankocer.github.io/corpus-app/#w=https://corpus-push.<your-subdomain>.workers.dev
```

Then turn on Settings → AI questions → Notifications.

To change who may call the Worker from a browser, edit `ALLOWED_ORIGIN` in `wrangler.toml`.
