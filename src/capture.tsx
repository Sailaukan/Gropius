import './index.css';
import '@/components/glaze/styles.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {CaptureWindow} from '@/app/capture/capture-window';
import {reload, reportErrors, startEventBridge} from '@/lib/tauri/events';
import {syncTheme} from '@/lib/theme';

async function boot() {
  // Opened in a plain browser during development: preview against the in-memory backend.
  if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
    (await import('@/dev/mock-backend')).installMockBackend();
  }
  reportErrors();
  try {
    await startEventBridge();
    await reload();
  } catch (error) {
    // The box still takes a task without the settings; it only misses the theme.
    console.error('capture: could not load settings', error);
  }
  syncTheme();
  createRoot(document.getElementById('root')!).render(<StrictMode><CaptureWindow/></StrictMode>);
}

void boot();
