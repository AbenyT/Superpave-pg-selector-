/** Small building blocks used across the page. */
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

export function Section({
  id,
  index,
  title,
  subtitle,
  icon,
  accent = 'ink',
  actions,
  children,
}: {
  id?: string;
  index?: string;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  accent?: 'hi' | 'lo' | 'ink';
  actions?: ReactNode;
  children: ReactNode;
}) {
  const bar = accent === 'hi' ? 'bg-hi' : accent === 'lo' ? 'bg-lo' : 'bg-ink';
  return (
    <section id={id} className="scroll-mt-6">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-8 w-1 rounded-full ${bar}`} aria-hidden="true" />
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                {icon && <span className="text-muted">{icon}</span>}
                {index && <span className="text-subtle">{index}</span>}
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </Card>
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  tone = 'ink',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'hi' | 'lo' | 'ink';
}) {
  const edge = tone === 'hi' ? 'border-l-hi' : tone === 'lo' ? 'border-l-lo' : 'border-l-line-strong';
  return (
    <div className={`rounded-xl border border-line border-l-4 ${edge} bg-raised px-4 py-3`}>
      <div className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div className="num mt-1 text-xl font-semibold">{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted">{note}</div>}
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  const cls =
    tone === 'ok'
      ? 'bg-ok-soft text-ok'
      : tone === 'warn'
        ? 'bg-warn-soft text-warn'
        : tone === 'bad'
          ? 'bg-bad-soft text-bad'
          : 'bg-raised text-muted';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm font-medium">
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-ok' : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint ? <span className="mt-1 block text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-subtle focus:border-lo focus:ring-2 focus:ring-lo/25';
