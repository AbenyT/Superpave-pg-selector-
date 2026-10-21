import {
  highTemperatureDesign,
  lowTemperatureDesign,
  roundHighGrade,
  RELIABILITY_PERCENT,
  roundLowGrade,
  Z_98,
} from '../src';

describe('reliability', () => {
  it('is fixed at 98% with z = 2.054 (to 3 decimals)', () => {
    expect(RELIABILITY_PERCENT).toBe(98);
    expect(Z_98).toBeCloseTo(2.054, 3);
    expect(Z_98.toFixed(3)).toBe('2.054');
  });
});

describe('high temperature formula (SHRP, 20 mm)', () => {
  // Hand check, Lat = 9.23°, mean = 35.36 °C, σ = 0.93 °C:
  //   0.00618 × 9.23² = 0.00618 × 85.1929 = 0.526492
  //   0.2289 × 9.23 = 2.112747
  //   T_air = 35.36 + 2.053749 × 0.93 = 37.269986
  //   (37.269986 − 0.526492 + 2.112747 + 42.2) × 0.9545 − 17.78
  //   = 81.056241 × 0.9545 − 17.78 = 77.368182 − 17.78 = 59.5882 °C
  it('matches the hand check', () => {
    const r = highTemperatureDesign(35.36, 0.93, 9.23);
    expect(r.designAirTemp).toBeCloseTo(37.269986, 6);
    expect(r.pavementTemp20mm).toBeCloseTo(59.5882, 4);
  });

  it('with σ = 0, T_air is exactly the mean', () => {
    expect(highTemperatureDesign(33.123, 0, 12).designAirTemp).toBe(33.123);
  });

  it('uses |latitude|, so 30°S gives the same result as 30°N', () => {
    // Hand check, Lat = 30, mean 40, σ 1.5: T_air = 43.08062
    //   (43.08062 − 5.562 + 6.867 + 42.2) × 0.9545 − 17.78 = 64.8660 °C
    const north = highTemperatureDesign(40, 1.5, 30);
    const south = highTemperatureDesign(40, 1.5, -30);
    expect(north.pavementTemp20mm).toBeCloseTo(64.866, 3);
    expect(south.pavementTemp20mm).toBe(north.pavementTemp20mm);
  });
});

describe('low temperature formula (LTPP, surface)', () => {
  // Hand check, Lat = 9.23°, mean annual minimum = 5.36 °C, σ = 2.47 °C, H = 0:
  //   base = −1.56 + 0.72 × 5.36 − 0.004 × 85.1929 + 6.26 × log10(25)
  //        = −1.56 + 3.8592 − 0.340772 + 8.751104 = 10.709533 °C
  //   σ² = 2.47² = 6.1009
  //   term = 2.053749 × √(4.4 + 0.52 × 6.1009) = 2.053749 × √7.572468
  //        = 2.053749 × 2.751812 = 5.651530
  //   T_pav = 10.709533 − 5.651530 = 5.0580 °C
  it('matches the hand check (σ squared)', () => {
    const r = lowTemperatureDesign(5.36, 2.47, 9.23);
    expect(r.baseTemp).toBeCloseTo(10.709533, 6);
    expect(r.reliabilityTerm).toBeCloseTo(5.65153, 5);
    expect(r.pavementTemp).toBeCloseTo(5.058, 4);
  });

  it('does NOT reproduce the notebook bug (σ not squared would give 5.81 °C)', () => {
    // Notebook: −z·√(4.4 + 0.52·σ) → 10.7095 − 2.0537 × √(4.4 + 1.2844) = 5.81 °C
    const r = lowTemperatureDesign(5.36, 2.47, 9.23);
    expect(r.pavementTemp).not.toBeCloseTo(5.81, 1);
  });

  it('with σ = 0 the reliability term is z·√4.4', () => {
    expect(lowTemperatureDesign(5.36, 0, 9.23).reliabilityTerm).toBeCloseTo(2.053749 * Math.sqrt(4.4), 6);
  });

  it('the low design air temperature is the value used in the formula (the mean of the minima)', () => {
    const r = lowTemperatureDesign(5.36, 2.47, 9.23);
    expect(r.designAirTemp).toBe(5.36);
  });

  it('matches a second hand check (cold site, 30°)', () => {
    // −1.56 + 0.72 × (−12) − 0.004 × 900 + 8.751104 = −5.048896
    // term = 2.053749 × √(4.4 + 0.52 × 9) = 2.053749 × 3.013304 = 6.188569
    // T_pav = −11.2375 °C
    expect(lowTemperatureDesign(-12, 3, 30).pavementTemp).toBeCloseTo(-11.2375, 4);
  });
});

describe('rounding to PG classes', () => {
  it.each([
    [40, 46],
    [46, 46],
    [46.01, 52],
    [57.77, 58],
    [59.59, 64],
    [64, 64],
    [64.0000000001, 64], // floating-point noise is ignored
    [87.9, 88],
  ])('high %p °C → PG %p', (t, grade) => {
    expect(roundHighGrade(t)).toEqual({ grade, outOfRange: false });
  });

  it('high above 88 °C is flagged', () => {
    expect(roundHighGrade(88.5)).toEqual({ grade: 88, outOfRange: true });
  });

  it.each([
    [10.7, -10],
    [-10, -10],
    [-10.01, -16],
    [-11.24, -16],
    [-16, -16],
    [-39.9, -40],
    [-45, -46],
    [-46, -46],
  ])('low %p °C → %p', (t, grade) => {
    expect(roundLowGrade(t)).toEqual({ grade, outOfRange: false });
  });

  it('low below −46 °C is flagged', () => {
    expect(roundLowGrade(-47)).toEqual({ grade: -46, outOfRange: true });
  });
});
