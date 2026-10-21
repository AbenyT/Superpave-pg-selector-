'use client';
import { useState } from 'react';
import { MIN_REAL_FRACTION, Z_98, type ExcludedYear, type GradeResult } from '@pg/engine';
import type { ClimateView } from '@/lib/api';
import { longDate, num, percent, shortDate, temp } from '@/lib/format';
import { PngButton } from './ExportButtons';
import { Snow, Thermo } from './icons';
import { Section, Stat } from './ui';
import { YearBarChart, type YearBar } from './YearBarChart';

function whyNotUsed(e: ExcludedYear, high: boolean): string {
  if (e.reason === 'no-usable-period') return high ? 'Not used: no 7 recorded days in a row' : 'Not used: no usable day';
  if (e.realFraction === 0) return 'Not used: no data this year';
  return `Not used: only ${percent(e.realFraction)} of days recorded (at least ${MIN_REAL_FRACTION * 100}% needed)`;
}

function allYears(used: number[], excluded: ExcludedYear[]): number[] {
  return [...used, ...excluded.map((e) => e.year)].sort((a, b) => a - b);
}

function TableToggle({ open, onClick, count }: { open: boolean; onClick: () => void; count: number }) {
  return (
    <button type="button" onClick={onClick}
      className="print-hidden rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-raised hover:text-ink">
      {open ? 'Hide table' : `Show table (${count} years)`}
    </button>
  );
}

function LeftOutNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="mt-2 text-xs text-subtle">
      Grey rows: {count} year{count > 1 ? 's' : ''} with less than {MIN_REAL_FRACTION * 100}% of days recorded. They are not
      used in the graph or the design.
    </p>
  );
}

export function SevenDaySection({ climate, grade, onPng }: { climate: ClimateView; grade: GradeResult; onPng: () => void }) {
  const [showTable, setShowTable] = useState(true);
  const h = grade.high;
  const byYear = new Map(climate.high.years.map((y) => [y.year, y]));
  const excluded = new Map(climate.high.excluded.map((e) => [e.year, e]));
  const years = allYears([...byYear.keys()], climate.high.excluded);

  const bars: YearBar[] = years.map((year) => {
    const y = byYear.get(year);
    if (!y) {
      return { year, value: null, highlight: false, tooltip: <><b>{year}</b><div className="text-muted">{whyNotUsed(excluded.get(year)!, true)}</div></> };
    }
    const lo = Math.min(...y.days);
    const hi = Math.max(...y.days);
    return {
      year,
      value: y.average,
      highlight: year === h.hottestYear,
      tooltip: (
        <>
          <div className="font-semibold">{year}{year === h.hottestYear && <span className="ml-1 text-xs font-medium text-hi">hottest</span>}</div>
          <div className="text-xs text-muted">{longDate(y.startDate)} – {longDate(y.endDate)}</div>
          <div className="mt-2 flex h-12 items-end gap-1" aria-hidden="true">
            {y.days.map((d, i) => (
              <div key={i} className="w-4 rounded-t bg-hi/80" style={{ height: `${hi === lo ? 100 : 25 + ((d - lo) / (hi - lo)) * 75}%` }} title={num(d)} />
            ))}
          </div>
          <div className="num mt-1 text-xs text-muted">{y.days.map((d) => num(d)).join(' · ')}</div>
          <div className="num mt-1">7-day average <b>{temp(y.average, 2)}</b></div>
        </>
      ),
    };
  });

  return (
    <Section id="seven-day" index="1" accent="hi" icon={<Thermo />} title="Annual 7-Day Consecutive Maximum Temperature"
      subtitle="The hottest 7 consecutive days of each year (daily maximum temperature)"
      actions={<div className="flex gap-2"><PngButton onClick={onPng} /><TableToggle open={showTable} onClick={() => setShowTable(!showTable)} count={years.length} /></div>}>
      <YearBarChart bars={bars} tone="hi" decimals={2} yLabel="7-day average (°C)" band={[h.mean - h.sd, h.mean + h.sd]}
        lines={[
          { value: h.mean, label: `Mean: ${temp(h.mean, 2)}`, style: 'dashed' },
          { value: h.designAirTemp, label: `Design (98%): ${temp(h.designAirTemp, 2)}`, style: 'solid' },
        ]} />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="hi" label="Mean of 7-day averages" value={temp(h.mean, 2)} note={`${h.yearsUsed} years used`} />
        <Stat tone="hi" label="Standard deviation σ" value={temp(h.sd, 2)} note="Shaded band: mean ± 1σ" />
        <Stat tone="hi" label="Design high air temperature" value={temp(h.designAirTemp, 2)} note={`mean + ${num(Z_98, 3)} × σ (98%) · input to the SHRP model`} />
        <Stat tone="hi" label="Hottest year" value={`${h.hottestYear}`} note={temp(byYear.get(h.hottestYear)!.average, 2)} />
      </div>
      {showTable && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="num w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-hi text-left text-xs font-semibold uppercase tracking-wide text-white">
                <th className="px-3 py-2">Year</th><th className="px-3 py-2">Start date</th><th className="px-3 py-2">End date</th>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => <th key={d} className="px-2 py-2 text-right">Day {d}</th>)}
                <th className="px-3 py-2 text-right">7-day average (°C)</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const y = byYear.get(year);
                if (!y) {
                  return (
                    <tr key={year} className="border-t border-line bg-raised italic text-subtle">
                      <td className="px-3 py-1.5">{year}</td>
                      <td className="px-3 py-1.5" colSpan={10}>{whyNotUsed(excluded.get(year)!, true)}</td>
                    </tr>
                  );
                }
                const top = year === h.hottestYear;
                return (
                  <tr key={year} className={`border-t border-line ${top ? 'bg-hi-soft font-semibold' : ''}`}>
                    <td className="px-3 py-1.5">{year}</td>
                    <td className="px-3 py-1.5">{shortDate(y.startDate)}</td>
                    <td className="px-3 py-1.5">{shortDate(y.endDate)}</td>
                    {y.days.map((d, i) => <td key={i} className="px-2 py-1.5 text-right">{num(d)}</td>)}
                    <td className="px-3 py-1.5 text-right font-semibold">{num(y.average, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <LeftOutNote count={climate.high.excluded.length} />
    </Section>
  );
}

export function AnnualMinSection({ climate, grade, onPng }: { climate: ClimateView; grade: GradeResult; onPng: () => void }) {
  const [showTable, setShowTable] = useState(true);
  const l = grade.low;
  const byYear = new Map(climate.low.years.map((y) => [y.year, y]));
  const excluded = new Map(climate.low.excluded.map((e) => [e.year, e]));
  const years = allYears([...byYear.keys()], climate.low.excluded);
  const lowest = byYear.get(l.coldestYear)!;

  const bars: YearBar[] = years.map((year) => {
    const y = byYear.get(year);
    if (!y) {
      return { year, value: null, highlight: false, tooltip: <><b>{year}</b><div className="text-muted">{whyNotUsed(excluded.get(year)!, false)}</div></> };
    }
    return {
      year,
      value: y.value,
      highlight: year === l.coldestYear,
      tooltip: (
        <>
          <div className="font-semibold">{year}{year === l.coldestYear && <span className="ml-1 text-xs font-medium text-lo">coldest</span>}</div>
          <div className="text-xs text-muted">{longDate(y.date)}</div>
          <div className="num mt-1">Minimum <b>{temp(y.value)}</b></div>
        </>
      ),
    };
  });

  return (
    <Section id="annual-min" index="2" accent="lo" icon={<Snow />} title="Annual Minimum Temperature"
      subtitle="The lowest daily minimum temperature of each year"
      actions={<div className="flex gap-2"><PngButton onClick={onPng} /><TableToggle open={showTable} onClick={() => setShowTable(!showTable)} count={years.length} /></div>}>
      <YearBarChart bars={bars} tone="lo" decimals={1} yLabel="Minimum temperature (°C)" band={[l.mean - l.sd, l.mean + l.sd]}
        lines={[{ value: l.designAirTemp, label: `Design (mean): ${temp(l.designAirTemp, 2)}`, style: 'solid' }]} />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="lo" label="Mean of yearly minima" value={temp(l.mean, 2)} note={`${l.yearsUsed} years used`} />
        <Stat tone="lo" label="Standard deviation σ" value={temp(l.sd, 2)} note="Shaded band: mean ± 1σ" />
        <Stat tone="lo" label="Low air temperature used in design" value={temp(l.designAirTemp, 2)} note="The mean: T_air in the LTPP model" />
        <Stat tone="lo" label="Coldest year" value={`${l.coldestYear}`} note={`${temp(lowest.value)} on ${shortDate(lowest.date)}`} />
      </div>
      {showTable && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="num w-full min-w-[420px] text-sm">
            <thead>
              <tr className="bg-lo text-left text-xs font-semibold uppercase tracking-wide text-white">
                <th className="px-3 py-2">Year</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Minimum temperature (°C)</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const y = byYear.get(year);
                if (!y) {
                  return (
                    <tr key={year} className="border-t border-line bg-raised italic text-subtle">
                      <td className="px-3 py-1.5">{year}</td>
                      <td className="px-3 py-1.5" colSpan={2}>{whyNotUsed(excluded.get(year)!, false)}</td>
                    </tr>
                  );
                }
                const top = year === l.coldestYear;
                return (
                  <tr key={year} className={`border-t border-line ${top ? 'bg-lo-soft font-semibold' : ''}`}>
                    <td className="px-3 py-1.5">{year}</td>
                    <td className="px-3 py-1.5">{longDate(y.date)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{num(y.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <LeftOutNote count={climate.low.excluded.length} />
    </Section>
  );
}
