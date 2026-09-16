# Corpus

A personal, symbiotic idea notebook. PWA — capture on Android, review and edit on Windows. See [docs/spec.md](./docs/spec.md) for the full spec (in Turkish; the product's primary user is Turkish-speaking).

## Development

```bash
npm install
npm run dev
```

To test the production build's offline/PWA behavior locally:

```bash
npm run build
npm run preview
```

## Stack

Vite + React + TypeScript · `vite-plugin-pwa` (offline, manifest) · Dexie (IndexedDB) · i18next (TR/EN) · `@dnd-kit` (sequencing) · `cytoscape` (connection map).

## Deployment

Every push to `main` builds via GitHub Actions and publishes to GitHub Pages (see `.github/workflows/deploy.yml`).
