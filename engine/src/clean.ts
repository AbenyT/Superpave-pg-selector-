/**
 * Data cleaning and gap filling (runs in the background; never shown on the page).
 *
 * 1. Drop rows with impossible calendar dates (e.g. 30 February).
 * 2. Keep the first value when a date appears more than once (a later copy is
 *    used only if the first copy was blank).
 * 3. Treat temperatures outside TEMP_LIMITS as missing (e.g. 162.0 °C).
 * 4. If Tmax < Tmin on a day, treat both values of that day as missing.
 * 5. Fill gaps of up to SHORT_GAP_MAX_DAYS days by linear interpolation and
 *    longer gaps with the long-term mean of that calendar month.
 *
 * Every day keeps a "kind" so later steps know which values were measured.
 */

import { daysInYear, fromDayNumber, isValidDate, toDayNumber } from './dates';

export type Element = 'tmax' | 'tmin';
export const ELEMENTS: readonly Element[] = ['tmax', 'tmin'];

/** One row of input. A field that is `undefined` is not part of the row; `null` means "blank". */
export interface Observation {
  year: number;
  month: number;
  day: number;
  tmax?: number | null;
  tmin?: number | null;
}

export type DayKind = 'real' | 'interpolated' | 'monthlyMean' | 'missing';

/** A continuous daily series from the first to the last measured day. */
export interface DailySeries {
  element: Element;
  /** Day number of values[0]. */
  startDay: number;
  values: (number | null)[];
  kinds: DayKind[];
}

export interface QualityReport {
  rowsRead: number;
  invalidDates: number;
  duplicates: Record<Element, number>;
  outOfRange: Record<Element, number>;
  tmaxBelowTmin: number;
  realDays: Record<Element, number>;
  interpolatedDays: Record<Element, number>;
  monthlyMeanDays: Record<Element, number>;
}

/** Physically plausible daily air temperatures, °C. */
export const TEMP_LIMITS = { minC: -50, maxC: 60 } as const;

/** Gaps of this many days or fewer are filled by linear interpolation. */
export const SHORT_GAP_MAX_DAYS = 3;

export interface CleanedData {
  series: Record<Element, DailySeries>;
  quality: QualityReport;
}

function emptyCounts(): Record<Element, number> {
  return { tmax: 0, tmin: 0 };
}

export function cleanObservations(observations: readonly Observation[]): CleanedData {
  const quality: QualityReport = {
    rowsRead: observations.length,
    invalidDates: 0,
    duplicates: emptyCounts(),
    outOfRange: emptyCounts(),
    tmaxBelowTmin: 0,
    realDays: emptyCounts(),
    interpolatedDays: emptyCounts(),
    monthlyMeanDays: emptyCounts(),
  };

  const byDay: Record<Element, Map<number, number | null>> = { tmax: new Map(), tmin: new Map() };

  for (const obs of observations) {
    if (!isValidDate(obs.year, obs.month, obs.day)) {
      quality.invalidDates++;
      continue;
    }
    const dayNumber = toDayNumber(obs.year, obs.month, obs.day);
    for (const element of ELEMENTS) {
      const raw = obs[element];
      if (raw === undefined) continue;
      const map = byDay[element];
      if (map.has(dayNumber)) {
        quality.duplicates[element]++;
        // Keep the first value, unless the first copy of this date was blank.
        if (map.get(dayNumber) !== null) continue;
      }
      let value: number | null = raw === null || !Number.isFinite(raw) ? null : raw;
      if (value !== null && (value < TEMP_LIMITS.minC || value > TEMP_LIMITS.maxC)) {
        quality.outOfRange[element]++;
        value = null;
      }
      map.set(dayNumber, value);
    }
  }

  for (const [dayNumber, tmax] of byDay.tmax) {
    const tmin = byDay.tmin.get(dayNumber);
    if (tmax !== null && tmin !== undefined && tmin !== null && tmax < tmin) {
      byDay.tmax.set(dayNumber, null);
      byDay.tmin.set(dayNumber, null);
      quality.tmaxBelowTmin++;
    }
  }

  const series = {
    tmax: buildSeries('tmax', byDay.tmax),
    tmin: buildSeries('tmin', byDay.tmin),
  };
  for (const element of ELEMENTS) {
    for (const kind of series[element].kinds) {
      if (kind === 'real') quality.realDays[element]++;
      else if (kind === 'interpolated') quality.interpolatedDays[element]++;
      else if (kind === 'monthlyMean') quality.monthlyMeanDays[element]++;
    }
  }
  return { series, quality };
}

function buildSeries(element: Element, map: Map<number, number | null>): DailySeries {
  let startDay = Infinity;
  let endDay = -Infinity;
  for (const [d, v] of map) {
    if (v === null) continue;
    if (d < startDay) startDay = d;
    if (d > endDay) endDay = d;
  }
  if (startDay === Infinity) return { element, startDay: 0, values: [], kinds: [] };

  const length = endDay - startDay + 1;
  const values: (number | null)[] = new Array(length).fill(null);
  const kinds: DayKind[] = new Array(length).fill('missing');
  for (const [dayNumber, value] of map) {
    if (value === null) continue;
    values[dayNumber - startDay] = value;
    kinds[dayNumber - startDay] = 'real';
  }
  fillGaps(startDay, values, kinds);
  return { element, startDay, values, kinds };
}

/** Long-term mean of measured values for each calendar month (index 1–12). */
function monthlyMeans(startDay: number, values: (number | null)[], kinds: DayKind[]): (number | null)[] {
  const sum = new Array(13).fill(0);
  const count = new Array(13).fill(0);
  values.forEach((v, i) => {
    if (kinds[i] !== 'real' || v === null) return;
    const { month } = fromDayNumber(startDay + i);
    sum[month] += v;
    count[month]++;
  });
  return sum.map((s, m) => (count[m] > 0 ? s / count[m] : null));
}

function fillGaps(startDay: number, values: (number | null)[], kinds: DayKind[]): void {
  const means = monthlyMeans(startDay, values, kinds);
  let i = 0;
  while (i < values.length) {
    if (kinds[i] !== 'missing') {
      i++;
      continue;
    }
    // The series starts and ends on measured days, so every gap has a measured day on both sides.
    let j = i;
    while (kinds[j + 1] === 'missing') j++;
    const gapLength = j - i + 1;
    if (gapLength <= SHORT_GAP_MAX_DAYS) {
      const before = values[i - 1] as number;
      const after = values[j + 1] as number;
      for (let k = i; k <= j; k++) {
        values[k] = before + ((after - before) * (k - i + 1)) / (gapLength + 1);
        kinds[k] = 'interpolated';
      }
    } else {
      for (let k = i; k <= j; k++) {
        const mean = means[fromDayNumber(startDay + k).month];
        if (mean === null) continue;
        values[k] = mean;
        kinds[k] = 'monthlyMean';
      }
    }
    i = j + 1;
  }
}

export interface YearCoverage {
  year: number;
  realDays: number;
  daysInYear: number;
  realFraction: number;
}

/** Share of measured days in each calendar year the series touches. */
export function yearCoverage(series: DailySeries): YearCoverage[] {
  if (series.values.length === 0) return [];
  const real = new Map<number, number>();
  series.kinds.forEach((kind, i) => {
    if (kind !== 'real') return;
    const { year } = fromDayNumber(series.startDay + i);
    real.set(year, (real.get(year) ?? 0) + 1);
  });
  const firstYear = fromDayNumber(series.startDay).year;
  const lastYear = fromDayNumber(series.startDay + series.values.length - 1).year;
  const result: YearCoverage[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    const realDays = real.get(year) ?? 0;
    result.push({ year, realDays, daysInYear: daysInYear(year), realFraction: realDays / daysInYear(year) });
  }
  return result;
}
