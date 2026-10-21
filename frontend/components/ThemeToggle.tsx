'use client';
import { setTheme, useTheme, type ThemeChoice } from '@/lib/theme';
import { Monitor, Moon, Sun } from './icons';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeChoice, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

/** Cycles System → Light → Dark. */
export function ThemeToggle() {
  const theme = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <button type="button" onClick={() => setTheme(NEXT[theme])} aria-label={`${LABEL[theme]} (click to change)`}
      title={LABEL[theme]}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-raised hover:text-ink">
      <Icon size={18} />
    </button>
  );
}
