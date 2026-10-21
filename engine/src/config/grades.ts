/** Superpave PG classes and the AASHTO M320 Table 1 facts used by the specification table. */

/** High-temperature classes, °C. */
export const HIGH_GRADES = [46, 52, 58, 64, 70, 76, 82, 88] as const;

/** Low-temperature classes, °C, warmest first. */
export const LOW_GRADES = [-10, -16, -22, -28, -34, -40, -46] as const;

/** Low-grade columns always shown in the specification table (as in the reference table). */
export const SPEC_TABLE_LOW_GRADES = [-10, -16, -22, -28, -34, -40] as const;

/** Low grades that AASHTO M320 Table 1 lists for each high grade. PG 88 is not in M320. */
export const M320_LOW_GRADES: Record<number, readonly number[]> = {
  46: [-34, -40, -46],
  52: [-10, -16, -22, -28, -34, -40, -46],
  58: [-16, -22, -28, -34, -40],
  64: [-10, -16, -22, -28, -34, -40],
  70: [-10, -16, -22, -28, -34, -40],
  76: [-10, -16, -22, -28, -34],
  82: [-10, -16, -22, -28, -34],
  88: [],
};

/** PAV ageing temperature by high grade (M320 Table 1); "(110)" is for desert climates. */
export function pavAgingTemperatureLabel(highGrade: number): string {
  if (highGrade <= 52) return '90';
  if (highGrade <= 64) return '100';
  return '100 (110)';
}

/** Fixed binder requirements (AASHTO M320 Table 1). */
export const SPEC_LIMITS = {
  flashPointMinC: 230,
  viscosityMaxPaS: 3,
  viscosityTestTempC: 135,
  originalDsrMinKPa: 1.0,
  rtfoMassChangeMaxPct: 1.0,
  rtfoDsrMinKPa: 2.2,
  pavAgingHours: 20,
  pavPressureMPa: 2.1,
  pavDsrMaxKPa: 5000,
  bbrStiffnessMaxMPa: 300,
  bbrMValueMin: 0.3,
  dttFailureStrainMinPct: 1.0,
} as const;

/** "PG 70-10" style label. */
export function gradeLabel(high: number, low: number): string {
  return `PG ${high}${low}`;
}
