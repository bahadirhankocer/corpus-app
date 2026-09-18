import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from './ai/queue';
import { maybeCreatePrompt, startBackgroundLoops } from './ai/scheduler';
import { Layer } from './app/Layer';
import type { LayerId, ScreenId } from './app/screens';
import { LAYERS } from './app/screens';
import { SwipeDeck } from './app/SwipeDeck';
import { OfflineStrip } from './components/OfflineStrip';
import { markSurfaced, pickResurfaceCandidate } from './db/entries';
import { ensureSettings, updateSettings, useSettings } from './db/settings';
import { db } from './db/db';
import type { Entry } from './db/types';
import { AtelierScreen } from './features/atelier/AtelierScreen';
import { CaptureScreen } from './features/capture/CaptureScreen';
import { runDueDigests } from './features/digests/runDigests';
import { EntryDetail } from './features/feed/EntryDetail';
import { FeedScreen } from './features/feed/FeedScreen';
import { ProjectInterview } from './features/interview/ProjectInterview';
import { syncPush } from './features/push/push';
import { QuestionFlow } from './features/question/QuestionFlow';
import { Resurface } from './features/resurface/Resurface';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { VersionsScreen } from './features/versions/VersionsScreen';
import i18n from './i18n';
import { ensurePersistentStorage } from './utils/persistStorage';
import { consumeSetupLink } from './utils/setupLink';

const MapScreen = lazy(() => import('./features/map/MapScreen').then((m) => ({ default: m.MapScreen })));
const SequenceScreen = lazy(() => import('./features/sequence/SequenceScreen').then((m) => ({ default: m.SequenceScreen })));
const DigestsScreen = lazy(() => import('./features/digests/DigestsScreen').then((m) => ({ default: m.DigestsScreen })));
const AudioLogScreen = lazy(() => import('./features/audiolog/AudioLogScreen').then((m) => ({ default: m.AudioLogScreen })));

const RESURFACE_INTERVAL_MS = 18 * 60 * 60 * 1000;

function layerFromHistory(): LayerId | null {
  const layer = (window.history.state as { layer?: LayerId } | null)?.layer;
  return layer && LAYERS.includes(layer) ? layer : null;
}

function App() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<ScreenId>('capture');
  const [layer, setLayer] = useState<LayerId | null>(layerFromHistory);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [interviewProjectId, setInterviewProjectId] = useState<string | null>(null);
  const [resurfaceEntry, setResurfaceEntry] = useState<Entry | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const settings = useSettings();

  const openLayer = useCallback((id: LayerId) => {
    window.history.pushState({ layer: id }, '');
    setLayer(id);
  }, []);

  const closeLayer = useCallback(() => {
    if (layerFromHistory()) window.history.back();
    else setLayer(null);
  }, []);

  useEffect(() => {
    const onPop = () => setLayer(layerFromHistory());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openQuestions = useCallback(async () => {
    const pending = (await db.prompts.where('status').equals('pending').count()) + (await db.followups.where('status').equals('pending').count());
    if (pending > 0) setQuestionOpen(true);
  }, []);

  // A push notification asks for a question right now.
  const answerPush = useCallback(async () => {
    setScreen('capture');
    await maybeCreatePrompt({ force: true });
    await openQuestions();
  }, [openQuestions]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void ensurePersistentStorage();
    void (async () => {
      const setup = await consumeSetupLink();
      await ensureSettings();
      if (cancelled) return;
      if (setup?.keySaved) setNotice(t('settings.ai.setupDone'));
      stop = startBackgroundLoops();
      void runDueDigests();
      void syncPush();
      const params = new URLSearchParams(window.location.search);
      if (params.get('prompt') === '1') {
        window.history.replaceState(window.history.state, '', window.location.pathname);
        void answerPush();
      }
    })();

    // A setup link opened while the app is already running only changes the hash.
    const onHash = () => {
      void consumeSetupLink().then((setup) => {
        if (setup?.keySaved) {
          setNotice(t('settings.ai.setupDone'));
          void kickAiQueue();
        }
      });
    };
    window.addEventListener('hashchange', onHash);

    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'corpus-prompt') void answerPush();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      stop?.();
      window.removeEventListener('hashchange', onHash);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(id);
  }, [notice]);

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
    if (i18n.language !== settings.lang) void i18n.changeLanguage(settings.lang);
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  async function handleResurfaceDone() {
    if (resurfaceEntry) await markSurfaced(resurfaceEntry.id);
    await updateSettings({ lastResurfaceAt: new Date().toISOString() });
    setResurfaceEntry(null);
  }

  if (resurfaceEntry) return <Resurface entry={resurfaceEntry} onDone={handleResurfaceDone} />;

  const layerNode: Record<LayerId, ReactNode> = {
    map: <MapScreen onOpenEntry={setOpenEntryId} />,
    sequence: <SequenceScreen onOpenEntry={setOpenEntryId} />,
    digests: <DigestsScreen />,
    audiolog: <AudioLogScreen />,
    settings: <SettingsScreen onStartInterview={setInterviewProjectId} />,
    versions: <VersionsScreen />,
  };

  return (
    <>
      <OfflineStrip />
      {notice && <div className="toast">{notice}</div>}
      <SwipeDeck
        active={screen}
        onChange={setScreen}
        panels={[
          {
            id: 'capture',
            node: <CaptureScreen onOpenQuestion={() => setQuestionOpen(true)} onOpenAtelier={() => setScreen('atelier')} />,
          },
          { id: 'feed', node: <FeedScreen onOpenEntry={setOpenEntryId} /> },
          {
            id: 'atelier',
            node: (
              <AtelierScreen
                onOpenEntry={setOpenEntryId}
                onOpenLayer={openLayer}
                onOpenQuestion={() => setQuestionOpen(true)}
                onStartInterview={setInterviewProjectId}
              />
            ),
          },
        ]}
      />
      {layer && (
        <Layer
          key={layer}
          code={t('layer.code', { n: String(LAYERS.indexOf(layer) + 1).padStart(2, '0') })}
          title={t(`layer.${layer}`)}
          onClose={closeLayer}
        >
          <Suspense fallback={null}>{layerNode[layer]}</Suspense>
        </Layer>
      )}
      {openEntryId && (
        <EntryDetail key={openEntryId} entryId={openEntryId} onClose={() => setOpenEntryId(null)} onNavigate={setOpenEntryId} />
      )}
      {questionOpen && <QuestionFlow onClose={() => setQuestionOpen(false)} />}
      {interviewProjectId && <ProjectInterview projectId={interviewProjectId} onClose={() => setInterviewProjectId(null)} />}
    </>
  );
}
export default App;
