// Light / dark theme choice. "system" follows the operating system; the choice is kept per browser.
import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

export type ThemeChoice = 'system' | 'light' | 'dark';
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  listeners.forEach((listener) => listener());
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read,
    () => 'system',
  );
}
