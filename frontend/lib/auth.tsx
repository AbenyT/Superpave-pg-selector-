'use client';
// Sign-in state for the whole site: the token is kept in this browser and checked with /auth/me.
import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as api from './api';
import type { User } from './api';
import { useSlow, WAKING_UP } from './use-slow';

type Status = 'loading' | 'signed-in' | 'signed-out';

interface AuthState {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(() => {
    api.setToken(null);
    setUser(null);
    setStatus('signed-out');
  }, []);

  // On first load: is there a stored token, and is it still valid?
  useEffect(() => {
    let cancelled = false;
    const check = api.getToken() ? api.me() : Promise.reject(new Error('not signed in'));
    check
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setStatus('signed-in');
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Keep the token when the server is only asleep or offline; drop it when the server rejects it.
        if (error instanceof api.ApiError && error.status === 0) setStatus('signed-out');
        else signOut();
      });
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  // Any 401 for a stored token (expired) signs the user out.
  useEffect(() => api.onSignedOut(signOut), [signOut]);

  const value = useMemo<AuthState>(() => {
    const signIn = (res: { accessToken: string; user: User }) => {
      api.setToken(res.accessToken);
      setUser(res.user);
      setStatus('signed-in');
    };
    return {
      status,
      user,
      login: async (email, password) => signIn(await api.login(email, password)),
      register: async (email, password, name) => signIn(await api.register(email, password, name)),
      logout: signOut,
    };
  }, [status, user, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** False during the server render and hydration, true afterwards. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/** Wrap pages that need an account: shows a loader while checking, sends signed-out visitors to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const mounted = useIsClient();
  const slow = useSlow(status === 'loading');
  useEffect(() => {
    if (status === 'signed-out') router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [status, router]);
  if (!mounted || status !== 'signed-in') {
    return <div className="py-24 text-center text-sm text-muted">{slow ? WAKING_UP : 'Checking your log-in…'}</div>;
  }
  return <>{children}</>;
}
