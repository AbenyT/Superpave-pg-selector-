/**
 * Yearly extremes used for design.
 *
 * Only measured days and short-gap interpolated days count. A day filled with a
 * monthly mean counts as missing here, so an invented value can never become a
 * year's hottest week or coldest day.
 */

import { DailySeries, DayKind } from './clean';
import { daysInMonth, formatIsoDate, fromDayNumber, toDayNumber } from './dates';

export const WINDOW_DAYS = 7;

export interface SevenDayMax {
  year: number;
  startDate: string;
  endDate: string;
  /** Tmax of day 1 … day 7, °C. */
  days: number[];
  average: number;
}

export interface AnnualMin {
  year: number;
  date: string;
  value: number;
}

function usable(kind: DayKind | undefined): boolean {
  return kind === 'real' || kind === 'interpolated';
}

/** Value of a day if it may be used for extremes, otherwise null. */
function usableValue(series: DailySeries, dayNumber: number): number | null {
  const i = dayNumber - series.startDay;
  if (i < 0 || i >= series.values.length || !usable(series.kinds[i])) return null;
  return series.values[i];
}

/**
 * The hottest 7 consecutive calendar days of `year`. Windows stay inside the
 * year and are skipped if any of their days is missing. Ties go to the earliest
 * window. Returns null if the year has no complete window.
 */
export function sevenDayMaxForYear(series: DailySeries, year: number): SevenDayMax | null {
  const first = toDayNumber(year, 1, 1);
  const last = toDayNumber(year, 12, 31);
  let best: SevenDayMax | null = null;
  for (let start = first; start + WINDOW_DAYS - 1 <= last; start++) {
    const days: number[] = [];
    for (let d = start; d < start + WINDOW_DAYS; d++) {
      const v = usableValue(series, d);
      if (v === null) break;
      days.push(v);
    }
    if (days.length < WINDOW_DAYS) continue;
    const average = days.reduce((a, b) => a + b, 0) / WINDOW_DAYS;
    if (best === null || average > best.average) {
      best = {
        year,
        startDate: formatIsoDate(start),
        endDate: formatIsoDate(start + WINDOW_DAYS - 1),
        days,
        average,
      };
    }
  }
  return best;
}

/** One cell of the monthly heatmap (year × month). */
export interface MonthlyCell {
  year: number;
  month: number;
  /** Mean of the usable days, or null when fewer than MIN_MONTH_FRACTION of the month's days are usable. */
  mean: number | null;
  /** Usable days (measured or short-gap interpolated). */
  days: number;
  daysInMonth: number;
}

/** A heatmap cell needs at least half of the month's days. */
export const MIN_MONTH_FRACTION = 0.5;

/** Monthly mean temperature for every month of every year the series touches (for the heatmaps). */
export function monthlyMeans(series: DailySeries): MonthlyCell[] {
  if (series.values.length === 0) return [];
  const firstYear = fromDayNumber(series.startDay).year;
  const lastYear = fromDayNumber(series.startDay + series.values.length - 1).year;
  const cells: MonthlyCell[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const dim = daysInMonth(year, month);
      const first = toDayNumber(year, month, 1);
      let sum = 0;
      let days = 0;
      for (let d = first; d < first + dim; d++) {
        const v = usableValue(series, d);
        if (v === null) continue;
        sum += v;
        days++;
      }
      cells.push({ year, month, mean: days >= MIN_MONTH_FRACTION * dim ? sum / days : null, days, daysInMonth: dim });
    }
  }
  return cells;
}

/** The lowest Tmin of `year` (earliest date on ties), or null if the year has no usable day. */
export function annualMinForYear(series: DailySeries, year: number): AnnualMin | null {
  const first = toDayNumber(year, 1, 1);
  const last = toDayNumber(year, 12, 31);
  let best: AnnualMin | null = null;
  for (let d = first; d <= last; d++) {
    const v = usableValue(series, d);
    if (v === null) continue;
    if (best === null || v < best.value) best = { year, date: formatIsoDate(d), value: v };
  }
  return best;
}
