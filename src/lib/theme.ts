// Glaze turns dark only through data-theme="dark" on an ancestor; it never reads the system setting itself. This keeps
// <html> in step with the Theme setting, following macOS while it is set to System.

import {useData} from '@/lib/store/data';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function apply() {
  const theme = useData.getState().settings?.theme ?? 'system';
  const dark = theme === 'dark' || (theme === 'system' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function syncTheme() {
  apply();
  systemDark.addEventListener('change', apply);
  useData.subscribe((state, previous) => {
    if (state.settings?.theme !== previous.settings?.theme) apply();
  });
}
