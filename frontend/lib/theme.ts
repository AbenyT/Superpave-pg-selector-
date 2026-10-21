// Dark / light theme choice. Dark is the default; the choice is kept per browser.
import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

export type ThemeChoice = 'light' | 'dark';
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'dark') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  document.documentElement.dataset.theme = choice;
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
    () => 'dark',
  );
}
