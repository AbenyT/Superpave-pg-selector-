import { annualMinForYear, cleanObservations, monthlyMeans, sevenDayMaxForYear, toDayNumber } from '../src';
import { dailyObservations, flatYear } from './helpers';

/** Index of a date inside a year that starts on 1 January. */
const idx = (year: number, month: number, day: number) => toDayNumber(year, month, day) - toDayNumber(year, 1, 1);

function tmaxSeries(start: string, values: (number | null)[]) {
  return cleanObservations(dailyObservations(start, values)).series.tmax;
}

describe('hottest 7 consecutive calendar days', () => {
  it('finds a planted hot week with its dates and daily values', () => {
    const y = flatYear(2021);
    for (let d = 10; d <= 16; d++) y[idx(2021, 6, d)] = 40;
    const r = sevenDayMaxForYear(tmaxSeries('2021-01-01', y), 2021)!;
    expect(r).toEqual({
      year: 2021,
      startDate: '2021-06-10',
      endDate: '2021-06-16',
      days: [40, 40, 40, 40, 40, 40, 40],
      average: 40,
    });
  });

  it('uses consecutive days, not the 7 hottest single days', () => {
    const y = flatYear(2021);
    [idx(2021, 2, 1), idx(2021, 5, 1), idx(2021, 8, 1)].forEach((i) => (y[i] = 50)); // isolated spikes
    for (let d = 1; d <= 7; d++) y[idx(2021, 10, d)] = 35;
    const r = sevenDayMaxForYear(tmaxSeries('2021-01-01', y), 2021)!;
    expect(r.startDate).toBe('2021-10-01');
    expect(r.average).toBe(35);
  });

  it('includes 29 February in a leap year', () => {
    const y = flatYear(2020);
    for (let d = 23; d <= 29; d++) y[idx(2020, 2, d)] = 40;
    const r = sevenDayMaxForYear(tmaxSeries('2020-01-01', y), 2020)!;
    expect(r.startDate).toBe('2020-02-23');
    expect(r.endDate).toBe('2020-02-29');
    expect(r.average).toBe(40);
  });

  it('a window may cross a short (≤ 3 day) gap: interpolated days are used', () => {
    const y: (number | null)[] = flatYear(2021);
    for (let d = 1; d <= 7; d++) y[idx(2021, 7, d)] = 40;
    y[idx(2021, 7, 3)] = null;
    y[idx(2021, 7, 4)] = null;
    const r = sevenDayMaxForYear(tmaxSeries('2021-01-01', y), 2021)!;
    expect(r.startDate).toBe('2021-07-01');
    expect(r.average).toBe(40);
  });

  it('skips every window that touches a long gap (monthly-mean days are not used)', () => {
    // Hot spell 1–12 July (40 °C) cut by a 4-day gap on 5–8 July; everything else 25 °C.
    const y: (number | null)[] = flatYear(2021);
    for (let d = 1; d <= 12; d++) y[idx(2021, 7, d)] = 40;
    for (let d = 5; d <= 8; d++) y[idx(2021, 7, d)] = null;
    const series = tmaxSeries('2021-01-01', y);
    expect(series.kinds[idx(2021, 7, 5)]).toBe('monthlyMean');

    const r = sevenDayMaxForYear(series, 2021)!;
    // Allowed best: 28 Jun – 4 Jul = (3×25 + 4×40)/7 = 33.571 (9–15 Jul ties; the earliest wins).
    // If the filled days were used, 1–7 Jul would give ≈ 35.5 instead.
    expect(r.startDate).toBe('2021-06-28');
    expect(r.endDate).toBe('2021-07-04');
    expect(r.average).toBeCloseTo(235 / 7, 12);
  });

  it('skips windows over days with no data at all', () => {
    // Data only from 1 Jan to 5 Jan and from 20 Jan onwards; the hot days sit next to the hole.
    const y: (number | null)[] = flatYear(2021);
    for (let d = 1; d <= 5; d++) y[idx(2021, 1, d)] = 45;
    for (let d = 6; d <= 19; d++) y[idx(2021, 1, d)] = null;
    const series = tmaxSeries('2021-01-01', y);
    const r = sevenDayMaxForYear(series, 2021)!;
    expect(r.average).toBe(25);
  });

  it('windows never cross from one year into the next', () => {
    // 29–31 Dec 2020 and 1–4 Jan 2021 are 45 °C, everything else 25 °C.
    const values = [...flatYear(2020), ...flatYear(2021)];
    const start = idx(2020, 12, 29);
    for (let i = start; i < start + 7; i++) values[i] = 45;
    const series = tmaxSeries('2020-01-01', values);

    const r2020 = sevenDayMaxForYear(series, 2020)!;
    expect(r2020.startDate).toBe('2020-12-25');
    expect(r2020.endDate).toBe('2020-12-31');
    expect(r2020.average).toBeCloseTo((4 * 25 + 3 * 45) / 7, 12);

    const r2021 = sevenDayMaxForYear(series, 2021)!;
    expect(r2021.startDate).toBe('2021-01-01');
    expect(r2021.average).toBeCloseTo((4 * 45 + 3 * 25) / 7, 12);
  });

  it('returns null when a year has no complete window', () => {
    expect(sevenDayMaxForYear(tmaxSeries('2021-01-01', [30, 30, 30]), 2021)).toBeNull();
    expect(sevenDayMaxForYear(tmaxSeries('2021-01-01', flatYear(2021)), 2022)).toBeNull();
  });
});

describe('annual minimum temperature', () => {
  function tminSeries(start: string, values: (number | null)[]) {
    const tmax = values.map((v) => (v === null ? null : v + 15));
    return cleanObservations(dailyObservations(start, tmax, values)).series.tmin;
  }

  it('finds the coldest day and its date (earliest on ties)', () => {
    const y = flatYear(2021, 10);
    y[idx(2021, 12, 5)] = 1.5;
    y[idx(2021, 12, 20)] = 1.5;
    expect(annualMinForYear(tminSeries('2021-01-01', y), 2021)).toEqual({
      year: 2021,
      date: '2021-12-05',
      value: 1.5,
    });
  });

  it('ignores monthly-mean-filled days', () => {
    // January 2020 is 0 °C; in 2021, 1–10 January is missing and every other day is 10 °C.
    // The January mean (0 and 10 mixed ≈ 4 °C) would otherwise become 2021's minimum.
    const values: (number | null)[] = [...flatYear(2020, 10), ...flatYear(2021, 10)];
    for (let d = 1; d <= 31; d++) values[idx(2020, 1, d)] = 0;
    const offset = 366;
    for (let d = 1; d <= 10; d++) values[offset + idx(2021, 1, d)] = null;
    const series = tminSeries('2020-01-01', values);
    expect(series.kinds[offset]).toBe('monthlyMean');
    expect(annualMinForYear(series, 2021)!.value).toBe(10);
    expect(annualMinForYear(series, 2020)!.value).toBe(0);
  });
});

describe('monthly means for the heatmaps', () => {
  it('averages measured and short-gap days; a month with under half its days recorded is empty', () => {
    const y: (number | null)[] = flatYear(2020); // leap year, 25 °C everywhere
    for (let d = 1; d <= 29; d++) y[idx(2020, 2, d)] = d <= 14 ? 20 : 30; // February: 14 × 20 + 15 × 30
    y[idx(2020, 4, 10)] = null; // 1-day gap → interpolated, still counted
    for (let d = 1; d <= 20; d++) y[idx(2020, 7, d)] = null; // 20-day gap → 11 of 31 days left
    const cells = monthlyMeans(tmaxSeries('2020-01-01', y));
    expect(cells).toHaveLength(12);
    expect(cells[1]).toEqual({ year: 2020, month: 2, mean: (14 * 20 + 15 * 30) / 29, days: 29, daysInMonth: 29 });
    expect(cells[3]).toMatchObject({ month: 4, mean: 25, days: 30 });
    expect(cells[6]).toEqual({ year: 2020, month: 7, mean: null, days: 11, daysInMonth: 31 });
  });

  it('covers every year the data touches, including empty ones', () => {
    const values: (number | null)[] = [...flatYear(2019), ...new Array(366).fill(null), ...flatYear(2021)];
    const cells = monthlyMeans(tmaxSeries('2019-01-01', values));
    expect(cells).toHaveLength(36);
    expect(cells.filter((c) => c.year === 2020).every((c) => c.mean === null && c.days === 0)).toBe(true);
  });
});
