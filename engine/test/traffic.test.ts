import { adjustForTraffic, esalClass, GRADE_BUMP_TABLE, speedClass } from '../src';

// One representative ESAL (millions) and speed (km/h) per class.
const ESAL = { 'lt0.3': 0.1, '0.3to3': 1, '3to10': 5, '10to30': 20, ge30: 115.6 } as const;
const SPEED = { standing: 10, slow: 50, standard: 100 } as const;

describe('speed classes', () => {
  it.each([
    [0, 'standing'],
    [19.99, 'standing'],
    [20, 'slow'],
    [70, 'slow'],
    [70.01, 'standard'],
    [120, 'standard'],
  ])('%p km/h → %p', (speed, cls) => {
    expect(speedClass(speed)).toBe(cls);
  });
});

describe('ESAL classes', () => {
  it.each([
    [0, 'lt0.3'],
    [0.299, 'lt0.3'],
    [0.3, '0.3to3'],
    [2.999, '0.3to3'],
    [3, '3to10'],
    [9.99, '3to10'],
    [10, '10to30'],
    [29.99, '10to30'],
    [30, 'ge30'],
    [500, 'ge30'],
  ])('%p million → %p', (esal, cls) => {
    expect(esalClass(esal)).toBe(cls);
  });
});

describe('M323 Table 1, every cell', () => {
  // [ESAL class, speed class, expected cell]
  const cells = [
    ['lt0.3', 'standing', 'consider'],
    ['lt0.3', 'slow', 0],
    ['lt0.3', 'standard', 0],
    ['0.3to3', 'standing', 2],
    ['0.3to3', 'slow', 1],
    ['0.3to3', 'standard', 0],
    ['3to10', 'standing', 2],
    ['3to10', 'slow', 1],
    ['3to10', 'standard', 0],
    ['10to30', 'standing', 2],
    ['10to30', 'slow', 1],
    ['10to30', 'standard', 'consider'],
    ['ge30', 'standing', 2],
    ['ge30', 'slow', 1],
    ['ge30', 'standard', 1],
  ] as const;

  it('config table has exactly these 15 cells', () => {
    for (const [e, s, cell] of cells) expect(GRADE_BUMP_TABLE[e][s]).toBe(cell);
    expect(Object.keys(GRADE_BUMP_TABLE)).toHaveLength(5);
  });

  it.each(cells)('%s / %s → %p', (e, s, cell) => {
    const r = adjustForTraffic(64, ESAL[e], SPEED[s]);
    expect(r.esalClass).toBe(e);
    expect(r.speedClass).toBe(s);
    expect(r.cell).toBe(cell);
    if (cell === 'consider') {
      expect(r.isConsiderCase).toBe(true);
      expect(r.highGradeAfter).toBe(64); // toggle off by default
      expect(adjustForTraffic(64, ESAL[e], SPEED[s], true).highGradeAfter).toBe(70); // toggle on
    } else {
      expect(r.isConsiderCase).toBe(false);
      expect(r.gradesAdded).toBe(cell);
      expect(r.highGradeAfter).toBe(64 + 6 * cell);
      // The toggle has no effect outside 'consider' cells.
      expect(adjustForTraffic(64, ESAL[e], SPEED[s], true).highGradeAfter).toBe(64 + 6 * cell);
    }
  });
});

describe('grade bumping limits', () => {
  it('Meisso case: PG 64, 115.6 M ESAL, 100 km/h → PG 70', () => {
    expect(adjustForTraffic(64, 115.6, 100).highGradeAfter).toBe(70);
  });

  it('stops at PG 88 and says so', () => {
    const r = adjustForTraffic(82, 50, 10); // +2 grades wanted → 94
    expect(r.highGradeAfter).toBe(88);
    expect(r.cappedAtMax).toBe(true);
  });

  it('reaching exactly PG 88 is not capping', () => {
    const r = adjustForTraffic(76, 50, 10);
    expect(r.highGradeAfter).toBe(88);
    expect(r.cappedAtMax).toBe(false);
  });
});
