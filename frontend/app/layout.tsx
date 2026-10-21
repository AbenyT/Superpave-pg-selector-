import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { THEME_BOOT_SCRIPT } from '@/lib/theme-script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Superpave PG Binder Selector',
  description: 'Superpave performance grade binder selection from daily temperature data — prepared by Abenezer Tilahun',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0f' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set by the boot script before React hydrates, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
        <header className="print-hidden border-b border-line bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-bold text-on-primary">PG</span>
              <div>
                <div className="text-base font-semibold leading-tight">Superpave PG Binder Selector</div>
                <div className="text-xs text-muted">Prepared by Abenezer Tilahun · AASHTO M320 / M323</div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <footer className="print-hidden mx-auto max-w-7xl px-4 pb-8 text-xs text-subtle sm:px-6">
          SHRP high-temperature model (20 mm) and LTPP low-temperature model (surface), 98% reliability.
          Prepared by Abenezer Tilahun.
        </footer>
      </body>
    </html>
  );
}
