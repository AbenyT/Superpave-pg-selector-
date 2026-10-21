'use client';
import { setTheme, useTheme } from '@/lib/theme';
import { Moon, Sun } from './icons';

/** Switches between the dark (default) and light theme. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Moon : Sun;
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Switch to the ${next} theme`} title={`Switch to the ${next} theme`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-raised hover:text-ink">
      <Icon size={18} />
    </button>
  );
}
