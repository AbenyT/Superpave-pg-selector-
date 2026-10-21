import {
  analyse,
  analyseClimate,
  AnalysisError,
  ClimateAnalysis,
  computeGrade,
  DesignInputs,
  ENGINE_VERSION,
  MIN_YEARS,
  Observation,
  toDayNumber,
} from '../src';
import { syntheticStation } from './helpers';

const MEISSO: DesignInputs = { latitude: 9.23, designEsalMillions: 115.6, designSpeedKmh: 100 };

/** Removes `count` days of one element starting on 1 March of `year`. */
function dropDays(obs: Observation[], year: number, count: number, element: 'tmax' | 'tmin'): Observation[] {
  const from = toDayNumber(year, 3, 1);
  return obs.map((o) => {
    const d = toDayNumber(o.year, o.month, o.day);
    return d >= from && d < from + count ? { ...o, [element]: null } : o;
  });
}

describe('notebook reproduction (Meisso yearly values printed by the notebook)', () => {
  // Yearly 7-day maxima and yearly minima 2005–2024, copied from the notebook output.
  const sevenDay = [
    35.014286, 35.028571, 35.185714, 35.728571, 36.171429, 35.542857, 36.471429, 35.485714, 34.942857, 33.533405,
    34.971429, 36.511521, 36.528571, 33.985714, 35.957143, 34.623041, 34.828571, 36.8, 33.885714, 36.085714,
  ];
  const minima = [
    1.0, 7.2, 7.0, 5.8, 5.2, 0.5, 3.5, 6.0, 5.0, 10.385079, 10.1, 5.0, 3.0, 2.8, 6.4, 6.5, 5.5, 6.0, 4.8, 5.5,
  ];
  const climate: Pick<ClimateAnalysis, 'high' | 'low'> = {
    high: {
      years: sevenDay.map((average, i) => ({ year: 2005 + i, startDate: '', endDate: '', days: [], average })),
      excludedYears: [],
      excluded: [],
    },
    low: { years: minima.map((value, i) => ({ year: 2005 + i, date: '', value })), excludedYears: [], excluded: [] },
  };

  it('high 59.60 °C as in the notebook; low 5.06 °C with σ squared; PG 64-10 → PG 70-10', () => {
    const r = computeGrade(climate, MEISSO);
    expect(r.reliabilityPercent).toBe(98);
    expect(r.z).toBeCloseTo(2.054, 3);
    expect(r.high.mean).toBeCloseTo(35.36411255, 8);
    expect(r.high.sd).toBeCloseTo(0.93289951, 8);
    expect(r.high.pavementTemp).toBeCloseTo(59.5978, 4); // notebook printed 59.60
    expect(r.low.mean).toBeCloseTo(5.35925395, 8);
    expect(r.low.sd).toBeCloseTo(2.47128571, 8);
    expect(r.low.pavementTemp).toBeCloseTo(5.0562, 4); // notebook (bug) printed 5.81
    expect(r.climateGrade.label).toBe('PG 64-10');
    expect(r.traffic.gradesAdded).toBe(1);
    expect(r.finalGrade.label).toBe('PG 70-10');
    expect(r.spec.title).toBe('Specification for Bitumen with Performance Grade PG 70-10');
    expect(r.binderType).toMatchObject({ name: 'Crude oil', temperatureSum: 80, ruleOf90SaysModified: false });
    expect(r.high.hottestYear).toBe(2022);
    expect(r.low.coldestYear).toBe(2010);
  });

  it('the "consider" toggle only re-runs computeGrade and does not change the climate data', () => {
    const before = JSON.stringify(climate);
    const inputs = { ...MEISSO, designEsalMillions: 20 }; // 10 to < 30 M at standard speed → "consider"
    const off = computeGrade(climate, inputs);
    const on = computeGrade(climate, { ...inputs, acceptConsiderBump: true });
    expect(JSON.stringify(climate)).toBe(before);
    expect(off.finalGrade.label).toBe('PG 64-10');
    expect(on.finalGrade.label).toBe('PG 70-10');
    expect(computeGrade(climate, inputs)).toEqual(off);
  });
});

describe('full analysis from daily data', () => {
  const station = syntheticStation(2005, 2024, 42);

  it('uses every complete year and returns 7 daily values per year', () => {
    const { climate, grade } = analyse(station, MEISSO);
    expect(climate.engineVersion).toBe(ENGINE_VERSION);
    expect(climate.high.years.map((y) => y.year)).toEqual(Array.from({ length: 20 }, (_, i) => 2005 + i));
    expect(climate.low.years).toHaveLength(20);
    for (const y of climate.high.years) {
      expect(y.days).toHaveLength(7);
      expect(y.average).toBeCloseTo(y.days.reduce((a, b) => a + b, 0) / 7, 10);
    }
    expect(grade.high.yearsUsed).toBe(20);
    expect(grade.engineVersion).toBe(ENGINE_VERSION);
  });

  it('drops a year with less than 75% measured data, separately for Tmax and Tmin', () => {
    // 2010: 40 Tmax days missing → 325/365 = 89 % → still used.
    expect(analyseClimate(dropDays(station, 2010, 40, 'tmax')).high.excludedYears).toEqual([]);
    // 2010: 100 Tmax days missing → 265/365 = 72.6 % → not used for the high side only.
    const climate = analyseClimate(dropDays(station, 2010, 100, 'tmax'));
    expect(climate.high.excludedYears).toEqual([2010]);
    expect(climate.high.years.map((y) => y.year)).not.toContain(2010);
    expect(climate.low.excludedYears).toEqual([]);
    // The tables show left-out years greyed out, with their share of recorded days.
    expect(climate.high.excluded).toEqual([{ year: 2010, realFraction: 265 / 365, reason: 'too-few-days' }]);
    expect(climate.low.excluded).toEqual([]);
  });

  it('75% boundary in a leap year: 275/366 is used, 274/366 is not', () => {
    expect(analyseClimate(dropDays(station, 2012, 91, 'tmin')).low.excludedYears).toEqual([]);
    expect(analyseClimate(dropDays(station, 2012, 92, 'tmin')).low.excludedYears).toEqual([2012]);
  });

  it('records data problems in the background quality report', () => {
    const messy: Observation[] = [
      ...station,
      { year: 2010, month: 2, day: 30, tmax: 30, tmin: 15 },
      { year: 2010, month: 5, day: 5, tmax: 1, tmin: 1 }, // duplicate date
    ];
    messy[100] = { ...messy[100], tmin: 162 };
    const { quality } = analyseClimate(messy);
    expect(quality.invalidDates).toBe(1);
    expect(quality.duplicates).toEqual({ tmax: 1, tmin: 1 });
    expect(quality.outOfRange.tmin).toBe(1);
  });
});

describe('one plain message when the data is not good enough', () => {
  const station = syntheticStation(2005, 2024, 7);

  it(`fewer than ${MIN_YEARS} usable Tmax years`, () => {
    const short = station.filter((o) => o.year <= 2008); // 4 years
    expect(() => analyseClimate(short)).toThrow(AnalysisError);
    expect(() => analyseClimate(short)).toThrow(
      'Only 4 years have enough maximum temperature (Tmax) data. At least 5 years with 75% of days recorded are needed.',
    );
  });

  it('no Tmin column', () => {
    const noTmin = station.map(({ tmin, ...o }) => o);
    let error: unknown;
    try {
      analyseClimate(noTmin);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AnalysisError);
    expect((error as AnalysisError).code).toBe('TOO_FEW_YEARS_LOW');
    expect((error as AnalysisError).message).toMatch(/^No year has enough minimum temperature \(Tmin\) data/);
  });

  it('no data at all', () => {
    expect(() => analyseClimate([])).toThrow('The file has no temperature values.');
  });

  it.each([
    [{ latitude: 95 }, 'Latitude must be a number from -90 to 90°.'],
    [{ designEsalMillions: -1 }, 'Design ESAL must be a number from 0 to 1000 million.'],
    [{ designSpeedKmh: NaN }, 'Design speed must be a number from 0 to 200 km/h.'],
  ])('rejects bad input %p', (patch, message) => {
    const climate = analyseClimate(station);
    expect(() => computeGrade(climate, { ...MEISSO, ...(patch as object) })).toThrow(message);
  });
});
