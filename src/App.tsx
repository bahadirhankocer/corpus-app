import { useEffect, useState } from 'react';

import { kickAiQueue } from './ai/queue';
import { BottomNav } from './app/BottomNav';
import type { ScreenId } from './app/screens';
import { OfflineStrip } from './components/OfflineStrip';
import { ensureSettings, useSettings } from './db/settings';
import { CaptureScreen } from './features/capture/CaptureScreen';
import { EntryDetail } from './features/feed/EntryDetail';
import { FeedScreen } from './features/feed/FeedScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import i18n from './i18n';

function App() {
  const [screen, setScreen] = useState<ScreenId>('capture');
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const settings = useSettings();

  useEffect(() => {
    void ensureSettings().then(() => kickAiQueue());
    const onOnline = () => void kickAiQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
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

  return (
    <>
      <OfflineStrip />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {screen === 'capture' && <CaptureScreen />}
        {screen === 'feed' && <FeedScreen onOpenEntry={setOpenEntryId} />}
        {screen === 'settings' && <SettingsScreen />}
      </div>
      <BottomNav active={screen} onChange={setScreen} />
      {openEntryId && <EntryDetail entryId={openEntryId} onClose={() => setOpenEntryId(null)} />}
    </>
  );
}

export default App;
