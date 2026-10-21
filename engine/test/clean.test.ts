import { cleanObservations, formatIsoDate, TEMP_LIMITS, yearCoverage } from '../src';
import { dailyObservations, flatYear } from './helpers';

describe('invalid dates and leap years', () => {
  it('drops 30 Feb, 31 Apr and 29 Feb in a non-leap year, keeps 29 Feb 2020', () => {
    const { series, quality } = cleanObservations([
      { year: 2020, month: 2, day: 28, tmax: 30 },
      { year: 2020, month: 2, day: 29, tmax: 31 },
      { year: 2020, month: 2, day: 30, tmax: 99 },
      { year: 2020, month: 4, day: 31, tmax: 99 },
      { year: 2021, month: 2, day: 29, tmax: 99 },
      { year: 2021, month: 13, day: 1, tmax: 99 },
    ]);
    expect(quality.invalidDates).toBe(4);
    expect(series.tmax.values).toEqual([30, 31]);
    expect(formatIsoDate(series.tmax.startDay + 1)).toBe('2020-02-29');
  });

  it('a leap year has 366 days for coverage', () => {
    const obs = dailyObservations('2020-01-01', flatYear(2020));
    const cov = yearCoverage(cleanObservations(obs).series.tmax);
    expect(cov).toEqual([{ year: 2020, realDays: 366, daysInYear: 366, realFraction: 1 }]);
  });
});

describe('duplicates, impossible values, Tmax < Tmin', () => {
  it('keeps the first value of a duplicated date', () => {
    const { series, quality } = cleanObservations([
      { year: 2020, month: 1, day: 1, tmax: 30, tmin: 15 },
      { year: 2020, month: 1, day: 1, tmax: 35, tmin: 10 },
      { year: 2020, month: 1, day: 2, tmax: 31, tmin: 16 },
    ]);
    expect(series.tmax.values).toEqual([30, 31]);
    expect(series.tmin.values).toEqual([15, 16]);
    expect(quality.duplicates).toEqual({ tmax: 1, tmin: 1 });
  });

  it('uses a later copy of a date when the first copy was blank', () => {
    const { series, quality } = cleanObservations([
      { year: 2020, month: 1, day: 1, tmax: null },
      { year: 2020, month: 1, day: 1, tmax: 33 },
      { year: 2020, month: 1, day: 1, tmax: 99 },
    ]);
    expect(series.tmax.values).toEqual([33]);
    expect(quality.duplicates.tmax).toBe(2);
  });

  it('wide-format rows (Tmax and Tmin in separate rows) are not duplicates of each other', () => {
    const { quality } = cleanObservations([
      { year: 2020, month: 1, day: 1, tmax: 30 },
      { year: 2020, month: 1, day: 1, tmin: 15 },
    ]);
    expect(quality.duplicates).toEqual({ tmax: 0, tmin: 0 });
  });

  it(`treats values outside ${TEMP_LIMITS.minC}…${TEMP_LIMITS.maxC} °C as missing (e.g. 162.0)`, () => {
    const { series, quality } = cleanObservations(
      dailyObservations('2020-01-01', [20, 20, 20], [10, 162.0, 12]),
    );
    expect(quality.outOfRange.tmin).toBe(1);
    expect(series.tmin.kinds).toEqual(['real', 'interpolated', 'real']);
    expect(series.tmin.values[1]).toBe(11);
  });

  it('when Tmax < Tmin, both values of that day become missing', () => {
    const { series, quality } = cleanObservations(
      dailyObservations('2020-01-01', [30, 12, 32], [15, 20, 17]),
    );
    expect(quality.tmaxBelowTmin).toBe(1);
    expect(series.tmax.kinds[1]).toBe('interpolated');
    expect(series.tmin.kinds[1]).toBe('interpolated');
    expect(series.tmax.values[1]).toBe(31);
    expect(series.tmin.values[1]).toBe(16);
  });

  it('blank and non-numeric values are missing', () => {
    const { series } = cleanObservations(dailyObservations('2020-01-01', [30, null, NaN, 33], [1, 1, 1, 1]));
    expect(series.tmax.kinds).toEqual(['real', 'interpolated', 'interpolated', 'real']);
  });
});

describe('gap filling', () => {
  it('fills a 3-day gap by straight-line interpolation', () => {
    const { series, quality } = cleanObservations(dailyObservations('2020-03-01', [10, null, null, null, 14]));
    expect(series.tmax.values).toEqual([10, 11, 12, 13, 14]);
    expect(series.tmax.kinds).toEqual(['real', 'interpolated', 'interpolated', 'interpolated', 'real']);
    expect(quality.interpolatedDays.tmax).toBe(3);
  });

  it('fills a 4-day gap with the mean of measured values for that month, and marks it', () => {
    // January 2020: days 1–10 = 20 °C, days 11–14 missing, days 15–31 = 30 °C.
    const jan = [...new Array(10).fill(20), null, null, null, null, ...new Array(17).fill(30)];
    const { series, quality } = cleanObservations(dailyObservations('2020-01-01', jan));
    const janMean = (10 * 20 + 17 * 30) / 27;
    for (let i = 10; i <= 13; i++) {
      expect(series.tmax.kinds[i]).toBe('monthlyMean');
      expect(series.tmax.values[i]).toBeCloseTo(janMean, 10);
    }
    expect(quality.monthlyMeanDays.tmax).toBe(4);
    expect(quality.realDays.tmax).toBe(27);
  });

  it('the series runs from the first to the last measured day', () => {
    const { series } = cleanObservations(dailyObservations('2020-01-01', [null, null, 25, 26, null]));
    expect(formatIsoDate(series.tmax.startDay)).toBe('2020-01-03');
    expect(series.tmax.values).toEqual([25, 26]);
  });
});

describe('year coverage', () => {
  it('counts only measured days, against the full calendar year', () => {
    const year = flatYear(2021).map((v, i) => (i < 40 ? null : v)); // 40 days missing
    const cov = yearCoverage(cleanObservations(dailyObservations('2021-01-01', year)).series.tmax);
    expect(cov[0].realDays).toBe(325);
    expect(cov[0].realFraction).toBeCloseTo(325 / 365, 12);
  });

  it('interpolated and monthly-mean days do not count as measured', () => {
    const year = flatYear(2021).map((v, i) => (i >= 100 && i < 102 ? null : i >= 200 && i < 210 ? null : v));
    const cov = yearCoverage(cleanObservations(dailyObservations('2021-01-01', year)).series.tmax);
    expect(cov[0].realDays).toBe(365 - 12);
  });
});
