import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Inter, Space_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { AuthProvider } from '@/lib/auth';
import { THEME_BOOT_SCRIPT } from '@/lib/theme-script';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Superpave PG Binder Selector', template: '%s · PG Binder Selector' },
  description: 'Superpave performance grade binder selection from daily temperature data — prepared by Abenezer Tilahun',
};

export const viewport: Viewport = {
  themeColor: '#1c1a35',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set by the boot script before React hydrates, hence suppressHydrationWarning.
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${spaceMono.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AuthProvider>
        {/* Vercel Web Analytics: counts visitors and pages without cookies (Vercel → project → Analytics). */}
        <Analytics />
      </body>
    </html>
  );
}
