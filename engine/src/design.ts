/**
 * Design pavement temperatures and PG rounding, at 98 % reliability (z = 2.054).
 *
 * High (SHRP model, 20 mm depth):
 *   T_air  = mean_7day + z·σ_7day
 *   T_20mm = (T_air − 0.00618·Lat² + 0.2289·Lat + 42.2)·0.9545 − 17.78
 *
 * Low (LTPP model, surface, H = 0 mm):
 *   T_pav = −1.56 + 0.72·T_air_low − 0.004·Lat² + 6.26·log10(H + 25) − z·√(4.4 + 0.52·σ²)
 *
 * Lat is used as |latitude| so southern sites work the same way.
 */

import { HIGH_GRADES, LOW_GRADES } from './config/grades';

/** Design reliability, %. The app always uses 98 %. */
export const RELIABILITY_PERCENT = 98;

/** Standard normal z for 98 %: Φ⁻¹(0.98) = 2.0537…, the same as scipy norm.ppf(0.98) in the notebook. */
export const Z_98 = 2.0537489106318225;

/** Depth for the low-temperature model, mm (pavement surface). */
export const LOW_TEMP_DEPTH_MM = 0;

export interface HighTemperatureDesign {
  designAirTemp: number;
  pavementTemp20mm: number;
}

export function highTemperatureDesign(mean7Day: number, sd7Day: number, latitude: number): HighTemperatureDesign {
  const lat = Math.abs(latitude);
  const designAirTemp = mean7Day + Z_98 * sd7Day;
  const pavementTemp20mm = (designAirTemp - 0.00618 * lat ** 2 + 0.2289 * lat + 42.2) * 0.9545 - 17.78;
  return { designAirTemp, pavementTemp20mm };
}

export interface LowTemperatureDesign {
  /** Mean annual minimum air temperature (the T_air_low in the formula). */
  meanAirTemp: number;
  /** The air temperature used in the formula (= the mean of the yearly minima). */
  designAirTemp: number;
  /** The formula without the reliability term. */
  baseTemp: number;
  /** z·√(4.4 + 0.52·σ²), subtracted from baseTemp. */
  reliabilityTerm: number;
  pavementTemp: number;
}

export function lowTemperatureDesign(meanMin: number, sdMin: number, latitude: number): LowTemperatureDesign {
  const lat = Math.abs(latitude);
  const baseTemp = -1.56 + 0.72 * meanMin - 0.004 * lat ** 2 + 6.26 * Math.log10(LOW_TEMP_DEPTH_MM + 25);
  const reliabilityTerm = Z_98 * Math.sqrt(4.4 + 0.52 * sdMin ** 2);
  return {
    meanAirTemp: meanMin,
    designAirTemp: meanMin,
    baseTemp,
    reliabilityTerm,
    pavementTemp: baseTemp - reliabilityTerm,
  };
}

export interface RoundedGrade {
  grade: number;
  /** True when the temperature is beyond the last PG class (the grade is then that last class). */
  outOfRange: boolean;
}

/** Removes floating-point noise such as 64.00000000001 before comparing with a class. */
function clean(t: number): number {
  return Math.round(t * 1e6) / 1e6;
}

/** Round up to the next high class (46 … 88). */
export function roundHighGrade(pavementTemp: number): RoundedGrade {
  const t = clean(pavementTemp);
  const grade = HIGH_GRADES.find((g) => g >= t);
  return grade === undefined
    ? { grade: HIGH_GRADES[HIGH_GRADES.length - 1], outOfRange: true }
    : { grade, outOfRange: false };
}

/** Round down to the next low class (−10 … −46). Anything warmer than −10 is −10. */
export function roundLowGrade(pavementTemp: number): RoundedGrade {
  const t = clean(pavementTemp);
  const grade = LOW_GRADES.find((g) => g <= t);
  return grade === undefined
    ? { grade: LOW_GRADES[LOW_GRADES.length - 1], outOfRange: true }
    : { grade, outOfRange: false };
}
