'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, useIsClient } from '@/lib/auth';
import { SITE } from '@/lib/site';
import { Close, LogOut, Menu, Plus } from './icons';
import { ThemeToggle } from './ThemeToggle';

const LANDING_LINKS = [
  ['/#features', 'Features'],
  ['/#how-it-works', 'How it works'],
  ['/#field', 'From lab to road'],
  ['/#contact', 'Contact'],
] as const;

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span className="display grid shrink-0 place-items-center rounded-xl bg-primary text-on-primary" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      PG
    </span>
  );
}

/** Top bar: logo, landing links, and Log in / Sign up or the signed-in menu. */
export function SiteHeader() {
  const { status, user, logout } = useAuth();
  const mounted = useIsClient();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const signedIn = mounted && status === 'signed-in';
  const accountLinks = signedIn ? (
    <>
      <Link href="/dashboard" className="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:text-ink">My analyses</Link>
      <Link href="/analyse" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-hover">
        <Plus size={16} />New analysis
      </Link>
      <button type="button" onClick={logout} title={`Log out ${user?.email ?? ''}`}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:text-ink">
        <LogOut size={16} />Log out
      </button>
    </>
  ) : (
    <>
      <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium text-ink transition hover:text-primary">Log in</Link>
      <Link href="/register" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-hover">Sign up</Link>
    </>
  );

  return (
    <header className="print-hidden sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.fullName}, home`}>
          <LogoMark />
          <span className="display text-[15px] leading-tight text-ink">{SITE.name}</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LANDING_LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:text-ink">{label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          {accountLinks}
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-raised">
            {open ? <Close size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-canvas px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {LANDING_LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="py-2 text-sm font-medium text-muted hover:text-ink">{label}</Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-4">{accountLinks}</div>
        </div>
      )}
    </header>
  );
}
