'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BINDER_COLORS } from '@/components/BinderSection';
import { ArrowRight, Plus, Trash } from '@/components/icons';
import { ApiError, deleteAnalysis, listAnalyses, type AnalysisSummary } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { gradeText, num } from '@/lib/format';
import { useSlow, WAKING_UP } from '@/lib/use-slow';

const BINDER_CODE: Record<string, 1 | 2 | 3> = { 'Crude oil': 1, 'High-quality crude oil': 2, 'Modifier required': 3 };

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<AnalysisSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slow = useSlow(!items && !error);

  useEffect(() => {
    listAnalyses()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Your analyses could not be loaded.'));
  }, []);

  const stats = useMemo(() => {
    if (!items) return null;
    const grades = new Map<string, number>();
    for (const a of items) grades.set(a.finalGrade, (grades.get(a.finalGrade) ?? 0) + 1);
    const top = [...grades].sort((a, b) => b[1] - a[1])[0];
    return {
      count: items.length,
      grades: grades.size,
      topGrade: top ? gradeText(top[0]) : '—',
      modified: items.filter((a) => a.binderType === 'Modifier required').length,
    };
  }, [items]);

  const remove = async (a: AnalysisSummary) => {
    if (!window.confirm(`Delete "${a.projectName}"? This cannot be undone.`)) return;
    try {
      await deleteAnalysis(a.id);
      setItems((list) => list?.filter((x) => x.id !== a.id) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The analysis could not be deleted.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl text-ink sm:text-3xl">Welcome{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="mt-1 text-sm text-muted">Your saved binder analyses, newest first.</p>
        </div>
        <Link href="/analyse" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover">
          <Plus size={16} />New analysis
        </Link>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}

      {stats && (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Analyses', String(stats.count)],
            ['Different grades', String(stats.grades)],
            ['Most used grade', stats.topGrade],
            ['Need a modifier', String(stats.modified)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-surface px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">{label}</p>
              <p className="display num mt-1 text-2xl text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      {!items && !error && <p className="py-20 text-center text-sm text-muted">{slow ? WAKING_UP : 'Loading your analyses…'}</p>}

      {items && items.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="display text-lg text-ink">No analyses yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Upload a station file with daily maximum and minimum temperatures to get your first PG grade.
          </p>
          <Link href="/analyse" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover">
            Start your first analysis <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5 transition hover:border-primary/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink" title={a.projectName}>{a.projectName}</p>
                  <p className="truncate text-sm text-muted">{a.stationName || 'Station not named'} · {num(a.latitude, 2)}°</p>
                </div>
                <span className="display num shrink-0 rounded-lg bg-primary px-2.5 py-1 text-sm text-on-primary">{gradeText(a.finalGrade)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-raised px-2.5 py-1 text-muted">Climate {gradeText(a.climateGrade)}</span>
                <span className="rounded-full bg-raised px-2.5 py-1 text-muted">{num(a.designEsalMillions, 1)} M ESAL · {num(a.designSpeedKmh, 0)} km/h</span>
                {a.binderType && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-muted">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BINDER_COLORS[BINDER_CODE[a.binderType] ?? 1] }} />
                    {a.binderType}
                  </span>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4 text-sm">
                <span className="text-subtle">Updated {new Date(a.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => remove(a)} aria-label={`Delete ${a.projectName}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-subtle transition hover:bg-bad-soft hover:text-bad">
                    <Trash size={16} />
                  </button>
                  <Link href={`/analyse?a=${a.id}`} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold text-ink transition hover:bg-raised">
                    Open <ArrowRight size={15} />
                  </Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
