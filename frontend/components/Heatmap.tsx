'use client';
/**
 * Year × month heatmap of monthly mean temperature (one hue, light → dark; sequential).
 * Hatched cells: under half of the month's days recorded. Outlined cell: the month holding the year's
 * design value (hottest 7-day window / coldest night), linking the heatmap to the sections above.
 */
import { useMemo, useState } from 'react';
import type { MonthlyCell } from '@pg/engine';
import { rampColor } from '@/lib/colors';
import { MONTH_NAMES, num, temp } from '@/lib/format';

export function Heatmap({
  title,
  cells,
  ramp,
  colderIsDarker,
  marked,
  notUsedYears,
  markLabel,
}: {
  title: string;
  cells: MonthlyCell[];
  ramp: readonly string[];
  colderIsDarker: boolean;
  /** year → month of the design value in that year. */
  marked: Map<number, number>;
  notUsedYears: Set<number>;
  markLabel: string;
}) {
  const [hover, setHover] = useState<{ cell: MonthlyCell; x: number; y: number } | null>(null);
  const { years, grid, min, max, monthMeans } = useMemo(() => {
    const ys = [...new Set(cells.map((c) => c.year))].sort((a, b) => a - b);
    const g = new Map(cells.map((c) => [`${c.year}-${c.month}`, c]));
    const means = cells.flatMap((c) => (c.mean === null ? [] : [c.mean]));
    const perMonth = Array.from({ length: 12 }, (_, i) => {
      const v = cells.filter((c) => c.month === i + 1 && c.mean !== null).map((c) => c.mean as number);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    });
    return { years: ys, grid: g, min: Math.min(...means), max: Math.max(...means), monthMeans: perMonth };
  }, [cells]);

  const colorOf = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return rampColor(ramp, colderIsDarker ? 1 - t : t);
  };
  const legend = colderIsDarker ? [...ramp].reverse() : ramp;
  const columns = '3.4rem repeat(12, minmax(2.4rem, 1fr))';

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
          <span className="num">{num(min)}</span>
          <span className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${legend.join(',')})` }} />
          <span className="num">{num(max)} °C</span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1" onMouseLeave={() => setHover(null)}>
        <div className="min-w-[34rem]" role="table" aria-label={title}>
          <div className="grid gap-[2px] text-[11px]" style={{ gridTemplateColumns: columns }} role="row">
            <div />
            {MONTH_NAMES.map((m) => (
              <div key={m} className="pb-1 text-center font-medium text-subtle" role="columnheader">{m}</div>
            ))}
          </div>
          {years.map((year) => (
            <div key={year} className="grid gap-[2px] pb-[2px] text-[11px]" style={{ gridTemplateColumns: columns }} role="row">
              <div className={`flex items-center gap-1 pr-1 font-medium ${notUsedYears.has(year) ? 'italic text-subtle' : 'text-muted'}`}
                role="rowheader" title={notUsedYears.has(year) ? 'Year not used in the design' : undefined}>
                {year}
                {notUsedYears.has(year) && <span className="text-[9px] not-italic">✕</span>}
              </div>
              {Array.from({ length: 12 }, (_, i) => {
                const cell = grid.get(`${year}-${i + 1}`);
                const isMarked = marked.get(year) === i + 1;
                if (!cell || cell.mean === null) {
                  return (
                    <div key={i} role="cell" className="hatch h-7 rounded-[3px] border border-line"
                      onMouseEnter={(e) => cell && setHover({ cell, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop })} />
                  );
                }
                const { fill, lightText } = colorOf(cell.mean);
                return (
                  <div key={i} role="cell"
                    className={`num flex h-7 items-center justify-center rounded-[3px] font-medium ${isMarked ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface' : ''}`}
                    style={{ background: fill, color: lightText ? '#ffffff' : '#111113' }}
                    onMouseEnter={(e) => setHover({ cell, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop })}>
                    {num(cell.mean)}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="mt-1 grid gap-[2px] border-t border-line pt-1 text-[11px]" style={{ gridTemplateColumns: columns }} role="row">
            <div className="font-semibold text-muted" role="rowheader">All yrs</div>
            {monthMeans.map((v, i) => (
              <div key={i} role="cell" className="num text-center font-semibold text-muted">{v === null ? '—' : num(v)}</div>
            ))}
          </div>
        </div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(hover.x + 40, 9999), top: hover.y + 64 }}>
          <div className="font-semibold">{MONTH_NAMES[hover.cell.month - 1]} {hover.cell.year}</div>
          <div className="num">
            {hover.cell.mean === null ? 'Not enough data' : `Mean ${temp(hover.cell.mean)}`}
          </div>
          <div className="text-muted">{hover.cell.days} of {hover.cell.daysInMonth} days recorded</div>
          {marked.get(hover.cell.year) === hover.cell.month && <div className="mt-0.5 font-medium">{markLabel}</div>}
        </div>
      )}
      <p className="mt-2 text-xs text-subtle">
        Outlined: {markLabel.toLowerCase()}. Hatched: fewer than half of the month&apos;s days recorded. ✕: year not used in the design.
      </p>
    </div>
  );
}
