import {
  BumpCell,
  ESAL_CLASSES,
  EsalClass,
  GRADE_BUMP_TABLE,
  GRADE_STEP_C,
  SPEED_CLASS_LIMITS,
  SpeedClass,
} from './config/gradeBumping';
import { HIGH_GRADES } from './config/grades';

export function speedClass(speedKmh: number): SpeedClass {
  if (speedKmh < SPEED_CLASS_LIMITS.standingBelowKmh) return 'standing';
  if (speedKmh <= SPEED_CLASS_LIMITS.slowUpToKmh) return 'slow';
  return 'standard';
}

export function esalClass(esalMillions: number): EsalClass {
  let found = ESAL_CLASSES[0].id;
  for (const c of ESAL_CLASSES) if (esalMillions >= c.fromMillions) found = c.id;
  return found;
}

export interface TrafficAdjustment {
  speedClass: SpeedClass;
  esalClass: EsalClass;
  /** The M323 Table 1 cell. */
  cell: BumpCell;
  /** True when the cell is 'consider' (the page then shows the "add one grade" toggle). */
  isConsiderCase: boolean;
  /** Grade steps actually added. */
  gradesAdded: number;
  highGradeBefore: number;
  highGradeAfter: number;
  /** True when the bump would go past PG 88 and was stopped there. */
  cappedAtMax: boolean;
}

/**
 * Applies M323 grade bumping to the climate high grade.
 * `acceptConsider` decides the 'consider' cells (default: not added).
 */
export function adjustForTraffic(
  climateHighGrade: number,
  esalMillions: number,
  speedKmh: number,
  acceptConsider = false,
): TrafficAdjustment {
  const sc = speedClass(speedKmh);
  const ec = esalClass(esalMillions);
  const cell = GRADE_BUMP_TABLE[ec][sc];
  const isConsiderCase = cell === 'consider';
  const gradesAdded = isConsiderCase ? (acceptConsider ? 1 : 0) : cell;
  const maxGrade = HIGH_GRADES[HIGH_GRADES.length - 1];
  const wanted = climateHighGrade + gradesAdded * GRADE_STEP_C;
  return {
    speedClass: sc,
    esalClass: ec,
    cell,
    isConsiderCase,
    gradesAdded,
    highGradeBefore: climateHighGrade,
    highGradeAfter: Math.min(wanted, maxGrade),
    cappedAtMax: wanted > maxGrade,
  };
}
