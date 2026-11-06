import './index.css';
import '@/components/glaze/styles.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {App} from '@/app/app';
import {reload, reportErrors, startEventBridge} from '@/lib/tauri/events';
import {syncTheme} from '@/lib/theme';

async function boot() {
  // Opened in a plain browser during development: preview the UI against an in-memory backend.
  const preview = import.meta.env.DEV && !('__TAURI_INTERNALS__' in window) ? await import('@/dev/mock-backend') : null;
  try {
    preview?.installMockBackend();
    reportErrors();
    await startEventBridge();
    await reload();
    syncTheme();
    createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
    preview?.openPreviewOverlay();
  } finally {
    // The window starts hidden so it never flashes white. Show it now that the page has its styles and first render;
    // not from requestAnimationFrame, which WebKit never runs for a window that is still hidden.
    void getCurrentWindow().show();
  }
}

void boot();
