/**
 * Traffic grade bumping, AASHTO M323 Table 1.
 *
 * Each cell is the number of high-temperature grade steps (6 °C each) to add,
 * or 'consider' where M323 says "consideration should be given to increasing
 * the high temperature grade by one grade equivalent". The low grade never
 * changes.
 */

export type SpeedClass = 'standing' | 'slow' | 'standard';
export type EsalClass = 'lt0.3' | '0.3to3' | '3to10' | '10to30' | 'ge30';
export type BumpCell = number | 'consider';

/** Speed classes: standing < 20 km/h, slow 20–70 km/h, standard > 70 km/h. */
export const SPEED_CLASS_LIMITS = {
  /** Below this speed (km/h) traffic is standing. */
  standingBelowKmh: 20,
  /** Up to and including this speed (km/h) traffic is slow. */
  slowUpToKmh: 70,
} as const;

export const SPEED_CLASS_LABELS: Record<SpeedClass, string> = {
  standing: 'Standing (< 20 km/h)',
  slow: 'Slow (20–70 km/h)',
  standard: 'Standard (> 70 km/h)',
};

/** ESAL classes in millions; each range includes its lower bound only. */
export const ESAL_CLASSES: ReadonlyArray<{ id: EsalClass; label: string; fromMillions: number }> = [
  { id: 'lt0.3', label: '< 0.3', fromMillions: 0 },
  { id: '0.3to3', label: '0.3 to < 3', fromMillions: 0.3 },
  { id: '3to10', label: '3 to < 10', fromMillions: 3 },
  { id: '10to30', label: '10 to < 30', fromMillions: 10 },
  { id: 'ge30', label: '≥ 30', fromMillions: 30 },
];

export const GRADE_BUMP_TABLE: Record<EsalClass, Record<SpeedClass, BumpCell>> = {
  'lt0.3': { standing: 'consider', slow: 0, standard: 0 },
  '0.3to3': { standing: 2, slow: 1, standard: 0 },
  '3to10': { standing: 2, slow: 1, standard: 0 },
  '10to30': { standing: 2, slow: 1, standard: 'consider' },
  ge30: { standing: 2, slow: 1, standard: 1 },
};

/** One grade step on the high-temperature side, °C. */
export const GRADE_STEP_C = 6;
