'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Alert } from './icons';
import { inputClass } from './ui';

/** Where to go after logging in: the ?next= page if it is on this site, else the dashboard. */
function nextPage(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

/**
 * Log-in and sign-up form. `compact` is the version inside the landing-page hero
 * (email and password only, like the reference design).
 */
export function AuthForm({ mode, compact = false }: { mode: 'login' | 'register'; compact?: boolean }) {
  const { status, login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  useEffect(() => {
    if (status === 'signed-in' && !compact) router.replace(nextPage());
  }, [status, compact, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login(email, password);
      else await register(email, password, name.trim() || undefined);
      router.push(compact ? '/analyse' : nextPage());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = `${inputClass} h-11 bg-surface`;
  return (
    <form onSubmit={submit} className="space-y-3" noValidate={false}>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          <Alert size={16} className="mt-0.5 shrink-0" />{error}
        </p>
      )}
      {!isLogin && !compact && (
        <label className="block text-sm font-medium text-ink">Name (optional)
          <input className={`${field} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} />
        </label>
      )}
      <label className={compact ? 'block' : 'block text-sm font-medium text-ink'}>
        {compact ? <span className="sr-only">Email</span> : 'Email'}
        <input className={`${field} ${compact ? '' : 'mt-1.5'}`} type="email" required value={email} placeholder={compact ? 'Your email' : undefined}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label className={compact ? 'block' : 'block text-sm font-medium text-ink'}>
        {compact ? <span className="sr-only">Password</span> : 'Password'}
        <input className={`${field} ${compact ? '' : 'mt-1.5'}`} type="password" required minLength={isLogin ? 1 : 8} value={password}
          placeholder={compact ? 'Choose a password (8+ characters)' : undefined}
          onChange={(e) => setPassword(e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} />
        {!isLogin && !compact && <span className="mt-1 block text-xs font-normal text-subtle">At least 8 characters.</span>}
      </label>
      <button type="submit" disabled={busy}
        className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60">
        {busy ? 'Please wait…' : isLogin ? 'Log in' : compact ? 'Sign up and start for free' : 'Create account'}
      </button>
      <p className={`text-sm text-muted ${compact ? '' : 'pt-1 text-center'}`}>
        {isLogin
          ? <>No account yet? <Link className="font-semibold text-ink underline decoration-primary underline-offset-4" href="/register">Create one</Link></>
          : <>Already have an account? <Link className="font-semibold text-ink underline decoration-primary underline-offset-4" href="/login">Log in</Link></>}
      </p>
    </form>
  );
}

/** Full log-in / sign-up page. */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  return (
    <div className="hero-glow">
      <div className="mx-auto grid min-h-[70vh] max-w-md content-center px-4 py-14">
        <div className="rounded-3xl border border-line bg-surface/80 p-7 shadow-float sm:p-9">
          <h1 className="display text-2xl text-ink">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-muted">
            {isLogin ? 'Log in to see your analyses.' : 'Free. Your analyses are saved and listed on your dashboard.'}
          </p>
          <div className="mt-6"><AuthForm mode={mode} /></div>
        </div>
      </div>
    </div>
  );
}
