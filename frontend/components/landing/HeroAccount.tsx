'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth, useIsClient } from '@/lib/auth';
import { AuthForm } from '../AuthForm';
import { ArrowRight } from '../icons';

/** Hero box: the sign-up form for visitors, or shortcuts for someone already logged in. */
export function HeroAccount() {
  const { status, user } = useAuth();
  const mounted = useIsClient();
  if (mounted && status === 'signed-in') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Logged in as <span className="font-semibold text-ink">{user?.name || user?.email}</span></p>
        <div className="flex flex-wrap gap-3">
          <Link href="/analyse" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover">
            New analysis <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" className="inline-flex h-11 items-center rounded-lg border border-line-strong bg-surface px-5 text-sm font-semibold text-ink transition hover:border-primary">
            My analyses
          </Link>
        </div>
      </div>
    );
  }
  return <AuthForm mode="register" compact />;
}

/** Links saved before the landing page existed were "/?a=<id>": send them to the analysis page. */
export function OldLinkRedirect() {
  const router = useRouter();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('a');
    if (id) router.replace(`/analyse?a=${encodeURIComponent(id)}`);
  }, [router]);
  return null;
}
