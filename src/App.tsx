import { lazy, Suspense, useEffect, useState } from 'react';

import { kickAiQueue } from './ai/queue';
import { BottomNav } from './app/BottomNav';
import type { ScreenId } from './app/screens';
import { SwipeDeck } from './app/SwipeDeck';
import { OfflineStrip } from './components/OfflineStrip';
import { markSurfaced, pickResurfaceCandidate } from './db/entries';
import { ensureSettings, updateSettings, useSettings } from './db/settings';
import type { Entry } from './db/types';
import { CaptureScreen } from './features/capture/CaptureScreen';
import { runDueDigests } from './features/digests/runDigests';
import { EntryDetail } from './features/feed/EntryDetail';
import { FeedScreen } from './features/feed/FeedScreen';
import { FollowUpFlow } from './features/followup/FollowUpFlow';
import { Resurface } from './features/resurface/Resurface';
import { SettingsScreen } from './features/settings/SettingsScreen';
import i18n from './i18n';
import { ensurePersistentStorage } from './utils/persistStorage';

const MapScreen = lazy(() => import('./features/map/MapScreen').then((m) => ({ default: m.MapScreen })));
const SequenceScreen = lazy(() =>
  import('./features/sequence/SequenceScreen').then((m) => ({ default: m.SequenceScreen })),
);
const DigestsScreen = lazy(() =>
  import('./features/digests/DigestsScreen').then((m) => ({ default: m.DigestsScreen })),
);
const AudioLogScreen = lazy(() =>
  import('./features/audiolog/AudioLogScreen').then((m) => ({ default: m.AudioLogScreen })),
);

const RESURFACE_INTERVAL_MS = 18 * 60 * 60 * 1000;

function App() {
  const [screen, setScreen] = useState<ScreenId>('capture');
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [resurfaceEntry, setResurfaceEntry] = useState<Entry | null | undefined>(undefined);
  const settings = useSettings();

  useEffect(() => {
    void ensurePersistentStorage();
    void ensureSettings().then(() => kickAiQueue());
    void runDueDigests();
    const onOnline = () => void kickAiQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    (async () => {
      const current = await ensureSettings();
      const last = current.lastResurfaceAt ? new Date(current.lastResurfaceAt).getTime() : 0;
      if (Date.now() - last < RESURFACE_INTERVAL_MS) {
        setResurfaceEntry(null);
        return;
      }
      const candidate = await pickResurfaceCandidate();
      setResurfaceEntry(candidate ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (i18n.language !== settings.lang) {
      void i18n.changeLanguage(settings.lang);
    }
    if (settings.theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings]);

  async function handleResurfaceDone() {
    if (resurfaceEntry) await markSurfaced(resurfaceEntry.id);
    await updateSettings({ lastResurfaceAt: new Date().toISOString() });
    setResurfaceEntry(null);
  }

  if (resurfaceEntry) {
    return <Resurface entry={resurfaceEntry} onDone={handleResurfaceDone} />;
  }

  return (
    <>
      <OfflineStrip />
      <SwipeDeck
        active={screen}
        onChange={setScreen}
        panels={[
          { id: 'capture', node: <CaptureScreen onOpenFollowUp={() => setFollowUpOpen(true)} /> },
          { id: 'feed', node: <FeedScreen onOpenEntry={setOpenEntryId} /> },
          {
            id: 'map',
            node: (
              <Suspense fallback={null}>
                <MapScreen onOpenEntry={setOpenEntryId} />
              </Suspense>
            ),
          },
          {
            id: 'sequence',
            node: (
              <Suspense fallback={null}>
                <SequenceScreen onOpenEntry={setOpenEntryId} />
              </Suspense>
            ),
          },
          {
            id: 'digests',
            node: (
              <Suspense fallback={null}>
                <DigestsScreen />
              </Suspense>
            ),
          },
          {
            id: 'audiolog',
            node: (
              <Suspense fallback={null}>
                <AudioLogScreen />
              </Suspense>
            ),
          },
          { id: 'settings', node: <SettingsScreen /> },
        ]}
      />
      <BottomNav active={screen} onChange={setScreen} />
      {openEntryId && (
        <EntryDetail
          key={openEntryId}
          entryId={openEntryId}
          onClose={() => setOpenEntryId(null)}
          onNavigate={setOpenEntryId}
        />
      )}
      {followUpOpen && <FollowUpFlow onClose={() => setFollowUpOpen(false)} />}
    </>
  );
}

export default App;
