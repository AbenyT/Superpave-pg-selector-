/**
 * Everything the PDF and Excel exports need, plus the full calculation written out with the numbers filled in
 * (PDF appendix and Excel "Calculation" sheet). Plain text only, so it works in any font.
 */
import { ESAL_CLASSES, MIN_REAL_FRACTION, type ExcludedYear, type GradeResult } from '@pg/engine';
import type { ClimateView } from './api';
import { longDate, num, percent, signed } from './format';

export const AUTHOR = 'Abenezer Tilahun';

export interface ReportInput {
  projectName: string;
  stationName: string;
  latitude: number;
  fileName: string;
  period: string;
  esal: number;
  speed: number;
  climate: ClimateView;
  grade: GradeResult;
  link?: string;
}

export interface StepSection {
  title: string;
  lines: { label?: string; text: string; strong?: boolean }[];
}

const SPEED_LABEL = { standing: 'standing (< 20 km/h)', slow: 'slow (20–70 km/h)', standard: 'standard (> 70 km/h)' };

function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function statLines(values: number[], mean: number, sd: number, name: string): StepSection['lines'] {
  const n = values.length;
  const sq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return [
    { label: 'Values', text: `${n} yearly values: ${values.map((v) => num(v, 2)).join(', ')} °C` },
    { label: 'Mean', text: `${name} = Σx / n = ${num(sumOf(values), 3)} / ${n} = ${num(mean, 3)} °C` },
    { label: 'σ', text: `σ = √( Σ(x − mean)² / (n − 1) ) = √( ${num(sq, 4)} / ${n - 1} ) = ${num(sd, 3)} °C` },
  ];
}

function leftOut(excluded: ExcludedYear[]): string {
  if (excluded.length === 0) return 'none';
  return excluded.map((e) => `${e.year} (${percent(e.realFraction)})`).join(', ');
}

export function calculationSteps(r: ReportInput): StepSection[] {
  const { grade: g, climate: c } = r;
  const lat = Math.abs(r.latitude);
  const lat2 = lat * lat;
  const z = g.z;
  const h = g.high;
  const l = g.low;
  const highSum = h.designAirTemp - 0.00618 * lat2 + 0.2289 * lat + 42.2;
  const root = Math.sqrt(4.4 + 0.52 * l.sd ** 2);
  const t = g.traffic;
  const esalLabel = ESAL_CLASSES.find((e) => e.id === t.esalClass)?.label ?? '';
  const cell = t.cell === 'consider' ? `consider +1 (${t.gradesAdded ? 'added' : 'not added'})` : `+${t.cell}`;
  const spec = g.spec;
  const sel = spec.columns[spec.selectedIndex];
  const hottest = c.high.years.find((y) => y.year === h.hottestYear)!;
  const coldest = c.low.years.find((y) => y.year === l.coldestYear)!;

  return [
    {
      title: 'A. Data used',
      lines: [
        { label: 'File', text: `${r.fileName}${r.stationName ? ` (station ${r.stationName})` : ''}, data ${r.period}` },
        { label: 'Rule', text: `A year is used when at least ${MIN_REAL_FRACTION * 100}% of its days are recorded (Tmax and Tmin checked separately). Gaps of up to 3 days are interpolated; longer gaps are not used for the extremes.` },
        { label: 'Tmax years', text: `${c.high.years.length} used; left out: ${leftOut(c.high.excluded)}` },
        { label: 'Tmin years', text: `${c.low.years.length} used; left out: ${leftOut(c.low.excluded)}` },
      ],
    },
    {
      title: 'B. Annual 7-day consecutive maximum temperature',
      lines: [
        { text: 'For each year: the hottest 7 consecutive calendar days of daily maximum temperature, averaged.' },
        ...statLines(c.high.years.map((y) => y.average), h.mean, h.sd, 'Mean of 7-day averages'),
        { label: 'Hottest', text: `${hottest.year}: ${longDate(hottest.startDate)} – ${longDate(hottest.endDate)}, average ${num(hottest.average, 2)} °C` },
      ],
    },
    {
      title: 'C. SHRP high-temperature model (pavement temperature at 20 mm)',
      lines: [
        { label: 'Formula', text: 'T(air) = mean(7-day) + z × σ(7-day)' },
        { text: 'T(20 mm) = (T(air) − 0.00618 × Lat² + 0.2289 × Lat + 42.2) × 0.9545 − 17.78' },
        { label: 'Inputs', text: `mean = ${num(h.mean, 3)} °C, σ = ${num(h.sd, 3)} °C, z = ${num(z, 4)} (98% reliability), Lat = ${num(lat, 2)}°` },
        { label: 'Air', text: `T(air) = ${num(h.mean, 3)} + ${num(z, 4)} × ${num(h.sd, 3)} = ${num(h.designAirTemp, 3)} °C` },
        { label: 'Lat terms', text: `0.00618 × ${num(lat, 2)}² = 0.00618 × ${num(lat2, 4)} = ${num(0.00618 * lat2, 4)};  0.2289 × ${num(lat, 2)} = ${num(0.2289 * lat, 4)}` },
        { label: 'Pavement', text: `T(20 mm) = (${num(h.designAirTemp, 3)} − ${num(0.00618 * lat2, 4)} + ${num(0.2289 * lat, 4)} + 42.2) × 0.9545 − 17.78` },
        { text: `= ${num(highSum, 4)} × 0.9545 − 17.78 = ${num(h.pavementTemp, 3)} °C` },
        { label: 'Grade', text: `Rounded up to the next high class (46, 52, 58, 64, 70, 76, 82, 88): PG ${g.climateGrade.high}`, strong: true },
      ],
    },
    {
      title: 'D. Annual minimum temperature',
      lines: [
        { text: 'For each year: the lowest daily minimum temperature.' },
        ...statLines(c.low.years.map((y) => y.value), l.mean, l.sd, 'Mean of yearly minima'),
        { label: 'Coldest', text: `${coldest.year}: ${longDate(coldest.date)}, ${num(coldest.value, 1)} °C` },
      ],
    },
    {
      title: 'E. LTPP low-temperature model (pavement surface, H = 0 mm)',
      lines: [
        { label: 'Formula', text: 'T(pav) = −1.56 + 0.72 × T(air) − 0.004 × Lat² + 6.26 × log10(H + 25) − z × √(4.4 + 0.52 × σ²)' },
        { label: 'Inputs', text: `T(air) = mean of yearly minima = ${num(l.meanAirTemp, 3)} °C, σ = ${num(l.sd, 3)} °C, z = ${num(z, 4)}, Lat = ${num(lat, 2)}°, H = 0` },
        { label: 'Terms', text: `−1.56 + 0.72 × ${num(l.meanAirTemp, 3)} − 0.004 × ${num(lat2, 4)} + 6.26 × log10(25)` },
        { text: `= −1.56 + ${num(0.72 * l.meanAirTemp, 4)} − ${num(0.004 * lat2, 4)} + ${num(6.26 * Math.log10(25), 4)} = ${num(l.baseTemp, 4)} °C` },
        { label: 'Reliability', text: `z × √(4.4 + 0.52 × ${num(l.sd, 3)}²) = ${num(z, 4)} × √${num(4.4 + 0.52 * l.sd ** 2, 4)} = ${num(z, 4)} × ${num(root, 4)} = ${num(l.reliabilityTerm, 4)} °C` },
        { label: 'Pavement', text: `T(pav) = ${num(l.baseTemp, 4)} − ${num(l.reliabilityTerm, 4)} = ${num(l.pavementTemp, 3)} °C` },
        { label: 'Grade', text: `Rounded down to the next low class (−10, −16, −22, −28, −34, −40, −46): ${signed(g.climateGrade.low)}`, strong: true },
      ],
    },
    {
      title: 'F. Traffic adjustment (AASHTO M323 Table 1)',
      lines: [
        { label: 'Traffic', text: `${num(r.esal, 2)} million ESAL → class "${esalLabel}"; ${num(r.speed, 0)} km/h → ${SPEED_LABEL[t.speedClass]}` },
        { label: 'Table cell', text: `${cell} grade(s); one grade = 6 °C; the low grade does not change` },
        { label: 'Result', text: `PG ${t.highGradeBefore} + ${t.gradesAdded} × 6 = PG ${t.highGradeAfter}${t.cappedAtMax ? ' (limited to PG 88)' : ''} → final grade ${g.finalGrade.label}`, strong: true },
      ],
    },
    {
      title: `G. Specification test temperatures for ${spec.label}`,
      lines: [
        { label: 'DSR', text: `Original binder and RTFO residue at the high grade temperature: ${spec.originalDsrTempC} °C` },
        { label: 'PAV DSR', text: `[(high + low) / 2] + 4 = [(${spec.highGrade} + (${signed(spec.lowGrade)})) / 2] + 4 = ${signed(sel.pavDsrTempC)} °C` },
        { label: 'BBR, DTT', text: `low + 10 = ${signed(spec.lowGrade)} + 10 = ${signed(sel.bbrTempC)} °C` },
        { label: 'PAV ageing', text: `${spec.pavAgingTempLabel} °C, 20 hours, 2.10 MPa (AASHTO M320 Table 1)` },
      ],
    },
  ];
}

export function fileBaseName(r: ReportInput): string {
  const project = r.projectName.trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 60) || 'project';
  return `${project}_${r.grade.finalGrade.label.replace(/\s+/g, '')}`;
}
