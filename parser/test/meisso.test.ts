/**
 * The user's real station file, end to end (file → parser → engine).
 * The file stays on the user's PC (test/fixtures/private is git-ignored), so this
 * test is skipped anywhere the file is not present.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { analyse } from '@pg/engine';
import { readTemperatureFile } from '../src';

const FILE = join(__dirname, 'fixtures', 'private', 'TT_Meisso.csv');
const run = existsSync(FILE) ? describe : describe.skip;

run('TT_Meisso.csv (Meiso Mission station, 2005–2024)', () => {
  const parsed = () => readTemperatureFile(new Uint8Array(readFileSync(FILE)), 'TT_Meisso.csv');

  it('reads the station layout and the station details', () => {
    const p = parsed();
    expect(p.layout).toBe('wide-days');
    expect(p.station).toEqual({ name: 'Meiso Mission', latitude: 9.23, longitude: 40.756, elevation: 1329 });
    expect(p.details.rowsUsed).toBe(421);
    expect(p.details.rowsSkipped).toBe(1); // the "X= NO DATA" note
  });

  it('finds the data problems the notebook missed or mishandled', () => {
    const p = parsed();
    const { climate } = analyse(p.observations, { latitude: 9.23, designEsalMillions: 115.6, designSpeedKmh: 100 });
    expect(climate.quality.outOfRange.tmin).toBe(2); // includes the 162.0 °C value
    expect(climate.quality.tmaxBelowTmin).toBe(5);
    expect(climate.quality.invalidDates).toBe(6);
  });

  it('uses only years with at least 75% measured days', () => {
    const p = parsed();
    const { climate } = analyse(p.observations, { latitude: 9.23, designEsalMillions: 115.6, designSpeedKmh: 100 });
    expect(climate.high.excludedYears).toEqual([2010, 2014, 2015, 2017, 2020]);
    expect(climate.low.excludedYears).toEqual([2014, 2015, 2017]);
    expect(climate.high.years).toHaveLength(15);
    expect(climate.low.years).toHaveLength(17);
    // Every year of 2005–2024 is either used or listed as left out, with its share of recorded days.
    const allHigh = [...climate.high.years.map((y) => y.year), ...climate.high.excludedYears].sort();
    expect(allHigh).toEqual(Array.from({ length: 20 }, (_, i) => 2005 + i));
    const y2010 = climate.high.excluded.find((e) => e.year === 2010)!;
    expect(y2010.reason).toBe('too-few-days');
    expect(y2010.realFraction).toBeCloseTo(220 / 365, 10);
    expect(climate.low.excluded.find((e) => e.year === 2014)!.realFraction).toBeCloseTo(31 / 365, 10);
  });

  it('gives PG 64-10 from climate and PG 70-10 after traffic (115.6 M ESAL, 100 km/h)', () => {
    const p = parsed();
    const { grade } = analyse(p.observations, {
      latitude: p.station.latitude!,
      designEsalMillions: 115.6,
      designSpeedKmh: 100,
    });
    expect(grade.high.yearsUsed).toBe(15);
    expect(grade.high.mean).toBeCloseTo(35.4543, 4);
    expect(grade.high.sd).toBeCloseTo(0.8630, 4);
    expect(grade.high.designAirTemp).toBeCloseTo(37.2267, 4);
    expect(grade.high.pavementTemp).toBeCloseTo(59.5468, 4);
    expect(grade.low.yearsUsed).toBe(17);
    expect(grade.low.mean).toBeCloseTo(4.9235, 4);
    expect(grade.low.sd).toBeCloseTo(1.9286, 4);
    expect(grade.low.pavementTemp).toBeCloseTo(5.2265, 4);
    expect(grade.climateGrade.label).toBe('PG 64-10');
    expect(grade.finalGrade.label).toBe('PG 70-10');
    expect(grade.high.hottestYear).toBe(2022);
    expect(grade.low.coldestYear).toBe(2010);
  });
});
