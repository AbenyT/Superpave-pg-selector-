/**
 * The two design temperature models on screen: the formula, then the same formula with the project's numbers.
 * SHRP (high temperature, 20 mm depth) and LTPP (low temperature, pavement surface).
 */
import type { ReactNode } from 'react';
import type { GradeResult } from '@pg/engine';
import { num, signed } from '@/lib/format';

const v = (x: number, d = 2) => num(x, d);

function Line({ label, children, strong = false }: { label?: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-x-2 py-1 ${strong ? 'font-semibold' : ''}`}>
      <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="num font-serif text-[15px] leading-relaxed">{children}</span>
    </div>
  );
}

function ModelCard({
  tone,
  name,
  full,
  sub,
  children,
}: {
  tone: 'hi' | 'lo';
  name: string;
  full: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-line border-t-4 ${tone === 'hi' ? 'border-t-hi' : 'border-t-lo'} bg-raised p-4 sm:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">
          <span className={`mr-2 rounded-md px-2 py-0.5 text-sm text-white ${tone === 'hi' ? 'bg-hi' : 'bg-lo'}`}>{name}</span>
          {full}
        </h3>
        <span className="text-xs text-muted">{sub}</span>
      </div>
      <div className="mt-3 divide-y divide-line">{children}</div>
    </div>
  );
}

export function DesignModels({ grade, latitude }: { grade: GradeResult; latitude: number }) {
  const lat = Math.abs(latitude);
  const lat2 = lat * lat;
  const z = grade.z;
  const h = grade.high;
  const l = grade.low;
  const highSum = h.designAirTemp - 0.00618 * lat2 + 0.2289 * lat + 42.2;
  const root = Math.sqrt(4.4 + 0.52 * l.sd * l.sd);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ModelCard tone="hi" name="SHRP" full="High-temperature model" sub="Pavement temperature at 20 mm depth">
        <Line label="Formula">
          T<sub>air</sub> = T̄<sub>7-day</sub> + z·σ<sub>7-day</sub>
        </Line>
        <Line>
          T<sub>20mm</sub> = (T<sub>air</sub> − 0.00618·Lat² + 0.2289·Lat + 42.2) × 0.9545 − 17.78
        </Line>
        <Line label="Inputs">
          T̄<sub>7-day</sub> = {v(h.mean)} °C, σ = {v(h.sd)} °C, z = {num(z, 3)} (98%), Lat = {v(lat)}° ({h.yearsUsed} years)
        </Line>
        <Line label="Air">
          T<sub>air</sub> = {v(h.mean)} + {num(z, 3)} × {v(h.sd)} = <b>{v(h.designAirTemp)} °C</b>
        </Line>
        <Line label="Pavement">
          T<sub>20mm</sub> = ({v(h.designAirTemp)} − {num(0.00618 * lat2, 3)} + {num(0.2289 * lat, 3)} + 42.2) × 0.9545 − 17.78
        </Line>
        <Line>
          = {v(highSum, 3)} × 0.9545 − 17.78 = <b>{v(h.pavementTemp)} °C</b>
        </Line>
        <Line label="Grade" strong>
          {v(h.pavementTemp)} °C → rounded up to <span className="text-hi">PG {grade.climateGrade.high}</span>
          {grade.finalGrade.high !== grade.climateGrade.high && <> → traffic → <span className="text-hi">PG {grade.finalGrade.high}</span></>}
        </Line>
      </ModelCard>

      <ModelCard tone="lo" name="LTPP" full="Low-temperature model" sub="Pavement temperature at the surface (H = 0 mm)">
        <Line label="Formula">
          T<sub>pav</sub> = −1.56 + 0.72·T<sub>air</sub> − 0.004·Lat² + 6.26·log<sub>10</sub>(H + 25) − z·√(4.4 + 0.52·σ²)
        </Line>
        <Line label="Inputs">
          T<sub>air</sub> = {v(l.meanAirTemp)} °C (mean of yearly minima), σ = {v(l.sd)} °C, z = {num(z, 3)}, Lat = {v(lat)}°, H = 0 ({l.yearsUsed} years)
        </Line>
        <Line label="Terms">
          −1.56 + {v(0.72 * l.meanAirTemp, 3)} − {v(0.004 * lat2, 3)} + {v(6.26 * Math.log10(25), 3)} = {v(l.baseTemp, 3)}
        </Line>
        <Line label="Reliability">
          {num(z, 3)} × √(4.4 + 0.52 × {v(l.sd)}²) = {num(z, 3)} × {v(root, 3)} = {v(l.reliabilityTerm, 3)}
        </Line>
        <Line label="Pavement">
          T<sub>pav</sub> = {v(l.baseTemp, 3)} − {v(l.reliabilityTerm, 3)} = <b>{v(l.pavementTemp)} °C</b>
        </Line>
        <Line label="Grade" strong>
          {v(l.pavementTemp)} °C → rounded down to <span className="text-lo">{signed(grade.climateGrade.low)}</span>
        </Line>
      </ModelCard>
    </div>
  );
}
