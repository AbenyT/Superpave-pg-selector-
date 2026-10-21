import { daysInYear, fromDayNumber, Observation, toDayNumber } from '../src';

/** Small deterministic random generator (mulberry32), so tests always see the same data. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Observations for consecutive days starting at `start` (ISO date). */
export function dailyObservations(
  start: string,
  tmax: readonly (number | null)[],
  tmin?: readonly (number | null)[],
): Observation[] {
  const [y, m, d] = start.split('-').map(Number);
  const first = toDayNumber(y, m, d);
  return tmax.map((value, i) => {
    const date = fromDayNumber(first + i);
    return { ...date, tmax: value, tmin: tmin ? tmin[i] : value === null ? null : value - 15 };
  });
}

/** A full year of flat temperatures (Tmax = base, Tmin = base − 15). */
export function flatYear(year: number, tmaxBase = 25): number[] {
  return new Array(daysInYear(year)).fill(tmaxBase);
}

/**
 * Realistic-looking synthetic station data: a seasonal curve plus random weather,
 * with a different random hot spell and cold night every year.
 */
export function syntheticStation(firstYear: number, lastYear: number, seed: number): Observation[] {
  const rand = seededRandom(seed);
  const obs: Observation[] = [];
  const level = 20 + rand() * 15;
  const range = 8 + rand() * 10;
  for (let year = firstYear; year <= lastYear; year++) {
    const n = daysInYear(year);
    for (let i = 0; i < n; i++) {
      const date = fromDayNumber(toDayNumber(year, 1, 1) + i);
      const season = Math.sin((2 * Math.PI * (i - 80)) / n);
      const tmax = level + 6 * season + (rand() - 0.5) * 6;
      const tmin = tmax - range - rand() * 4;
      obs.push({ ...date, tmax: Math.round(tmax * 10) / 10, tmin: Math.round(tmin * 10) / 10 });
    }
  }
  return obs;
}
