'use client';
/**
 * Site statistics for the owner: accounts and analyses (from the API) and a pointer to the visitor numbers
 * (Vercel Web Analytics). Counts only, no personal data. Each chart has one series, so the title names it.
 */
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight } from '@/components/icons';
import { ApiError, siteStats, type SiteStats } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { gradeText } from '@/lib/format';
import { useSlow, WAKING_UP } from '@/lib/use-slow';

/** Vercel project page with the visitor numbers (Analytics tab). */
const VERCEL_ANALYTICS = 'https://vercel.com/dashboard';

export default function AdminPage() {
  return (
    <RequireAuth>
      <Stats />
    </RequireAuth>
  );
}

function Stats() {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slow = useSlow(!stats && !error);

  useEffect(() => {
    siteStats()
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'The statistics could not be loaded.'));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="display text-2xl text-ink sm:text-3xl">Site statistics</h1>
      <p className="mt-1 text-sm text-muted">Accounts and analyses on your website. Counts only — no names or emails.</p>

      <a href={VERCEL_ANALYTICS} target="_blank" rel="noopener noreferrer"
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-5 py-4 transition hover:border-primary">
        <span>
          <span className="display block text-ink">Visitors and page views</span>
          <span className="text-sm text-muted">Every visit, also from people without an account: Vercel → your project → Analytics.</span>
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">Open Vercel <ArrowRight size={16} /></span>
      </a>

      {error && <p role="alert" className="mt-6 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}
      {!stats && !error && <p className="py-20 text-center text-sm text-muted">{slow ? WAKING_UP : 'Loading the statistics…'}</p>}

      {stats && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Accounts" value={stats.accounts.total} note={`+${stats.accounts.last7Days} in the last 7 days`} />
            <Tile label="Analyses" value={stats.analyses.total} note={`+${stats.analyses.last7Days} in the last 7 days`} />
            <Tile label="New accounts, 30 days" value={stats.accounts.last30Days} />
            <Tile label="Active accounts, 30 days" value={stats.analyses.activeAccounts30Days} note="made at least one analysis" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <DailyChart title="New accounts per day" data={stats.perDay} field="signUps" unit="account" />
            <DailyChart title="Analyses per day" data={stats.perDay} field="analyses" unit="analysis" />
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <h2 className="display text-base text-ink">Grades selected</h2>
            <p className="mt-0.5 text-sm text-muted">Final PG grade of every analysis</p>
            {stats.grades.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No analyses yet.</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {stats.grades.map((g) => (
                  <li key={g.grade} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="num font-semibold text-ink">{gradeText(g.grade)}</span>
                    <span className="h-3 rounded-r bg-raised">
                      <span className="block h-3 rounded-r bg-primary" style={{ width: `${(g.count / stats.grades[0].count) * 100}%` }} />
                    </span>
                    <span className="num text-right text-muted">{g.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">{label}</p>
      <p className="display num mt-1 text-3xl text-ink">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

function DailyChart({ title, data, field, unit }: {
  title: string; data: SiteStats['perDay']; field: 'signUps' | 'analyses'; unit: string;
}) {
  const total = data.reduce((n, d) => n + d[field], 0);
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="display text-base text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">Last 30 days · {total} in total</p>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis dataKey="date" tickFormatter={label} tickLine={false} axisLine={false} interval={6} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip cursor={{ fill: 'var(--raised)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as SiteStats['perDay'][number];
                const n = d[field];
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card">
                    <div className="text-muted">{label(d.date)}</div>
                    <div className="num font-semibold text-ink">{n} {n === 1 ? unit : unit === 'analysis' ? 'analyses' : `${unit}s`}</div>
                  </div>
                );
              }} />
            <Bar dataKey={field} fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
