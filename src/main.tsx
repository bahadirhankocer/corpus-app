import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-300.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-ext-300.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import '@fontsource/jost/latin-300.css'
import '@fontsource/jost/latin-400.css'
import '@fontsource/jost/latin-ext-300.css'
import '@fontsource/jost/latin-ext-400.css'
import './index.css'
import './i18n'
import App from './App.tsx'
import { importLegacyDatabases } from './db/legacy'
import { runDataMigrations } from './db/migrations'
import { consumeGoogleRedirect } from './features/export/googleDocs'

/** Service workers left by earlier builds at another path would keep serving an old copy of the app. */
async function removeForeignServiceWorkers(): Promise<void> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const scope = new URL(import.meta.env.BASE_URL, window.location.href).href
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    if (registration.scope !== scope) await registration.unregister()
  }
}

async function boot(): Promise<void> {
  // Data has to be in place before anything reads settings, or defaults would shadow the real ones.
  try {
    await importLegacyDatabases()
    await runDataMigrations()
  } catch (err) {
    console.error('startup migration failed', err)
  }
  void removeForeignServiceWorkers()
  consumeGoogleRedirect()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
