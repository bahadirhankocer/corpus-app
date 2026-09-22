import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { kickAiQueue } from './ai/queue';
import { maybeCreatePrompt, startBackgroundLoops } from './ai/scheduler';
import { useBackHandler } from './app/backStack';
import { Layer } from './app/Layer';
import type { LayerId, ScreenId } from './app/screens';
import { LAYERS } from './app/screens';
import { SwipeDeck } from './app/SwipeDeck';
import { OfflineStrip } from './components/OfflineStrip';
import { markSurfaced, pickResurfaceCandidate } from './db/entries';
import { pendingQuestionCount } from './db/questions';
import { ensureSettings, updateSettings, useSettings } from './db/settings';
import type { Entry } from './db/types';
import { CaptureScreen } from './features/capture/CaptureScreen';
import { CorpusScreen } from './features/corpus/CorpusScreen';
import { runDueDigests } from './features/digests/runDigests';
import { EntryDetail } from './features/feed/EntryDetail';
import { FeedScreen } from './features/feed/FeedScreen';
import { ProjectInterview } from './features/interview/ProjectInterview';
import { MapScreen } from './features/map/MapScreen';
import { syncPush } from './features/push/push';
import { QuestionFlow } from './features/question/QuestionFlow';
import { Resurface } from './features/resurface/Resurface';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { VersionsScreen } from './features/versions/VersionsScreen';
import i18n from './i18n';
import { ensurePersistentStorage } from './utils/persistStorage';
import { consumeSetupLink } from './utils/setupLink';

const LinksScreen = lazy(() => import('./features/links/LinksScreen').then((m) => ({ default: m.LinksScreen })));
const SequenceScreen = lazy(() => import('./features/sequence/SequenceScreen').then((m) => ({ default: m.SequenceScreen })));
const DigestsScreen = lazy(() => import('./features/digests/DigestsScreen').then((m) => ({ default: m.DigestsScreen })));
const AudioLogScreen = lazy(() => import('./features/audiolog/AudioLogScreen').then((m) => ({ default: m.AudioLogScreen })));

const RESURFACE_INTERVAL_MS = 18 * 60 * 60 * 1000;

function App() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<ScreenId>('corpus');
  const [layer, setLayer] = useState<LayerId | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [interviewProjectId, setInterviewProjectId] = useState<string | null>(null);
  const [resurfaceEntry, setResurfaceEntry] = useState<Entry | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const settings = useSettings();

  // Back walks down whatever is open; on the Corpus screen with nothing open it leaves the app.
  useBackHandler(screen !== 'corpus', () => setScreen('corpus'));
  useBackHandler(openEntryId !== null, () => setOpenEntryId(null));
  useBackHandler(capturing, () => setCapturing(false));
  useBackHandler(questionOpen, () => setQuestionOpen(false));
  useBackHandler(interviewProjectId !== null, () => setInterviewProjectId(null));

  const openQuestions = useCallback(async () => {
    if ((await pendingQuestionCount()) > 0) setQuestionOpen(true);
  }, []);

  // A push notification asks for a question right now.
  const answerPush = useCallback(async () => {
    setScreen('corpus');
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

  useBackHandler(Boolean(resurfaceEntry), () => void handleResurfaceDone());

  if (resurfaceEntry) return <Resurface entry={resurfaceEntry} onDone={handleResurfaceDone} />;

  const layerNode: Record<LayerId, ReactNode> = {
    sequence: <SequenceScreen onOpenEntry={setOpenEntryId} />,
    links: <LinksScreen onOpenEntry={setOpenEntryId} />,
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
            id: 'corpus',
            node: (
              <CorpusScreen
                onOpenEntry={setOpenEntryId}
                onOpenLayer={setLayer}
                onOpenQuestion={() => setQuestionOpen(true)}
                onCapture={() => setCapturing(true)}
              />
            ),
          },
          { id: 'feed', node: <FeedScreen onOpenEntry={setOpenEntryId} /> },
          { id: 'map', node: <MapScreen onOpenEntry={setOpenEntryId} /> },
        ]}
      />
      {layer && (
        <Layer
          key={layer}
          code={t('layer.code', { n: String(LAYERS.indexOf(layer) + 1).padStart(2, '0') })}
          title={t(`layer.${layer}`)}
          onClose={() => setLayer(null)}
        >
          <Suspense fallback={null}>{layerNode[layer]}</Suspense>
        </Layer>
      )}
      {capturing && (
        <CaptureScreen
          onClose={() => setCapturing(false)}
          onSaved={() => {
            setCapturing(false);
            setNotice(t('capture.saved'));
          }}
        />
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
