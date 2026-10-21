/**
 * The "Specification for Bitumen with Performance Grade" table for any grade.
 *
 * Test temperatures:
 *   Original binder and RTFO DSR: the high grade.
 *   PAV DSR (intermediate):       (high + low) / 2 + 4, for each low-grade column.
 *   BBR and DTT:                  low + 10, for each low-grade column.
 */

import {
  M320_LOW_GRADES,
  SPEC_LIMITS,
  SPEC_TABLE_LOW_GRADES,
  gradeLabel,
  pavAgingTemperatureLabel,
} from './config/grades';

export interface SpecColumn {
  lowGrade: number;
  pavDsrTempC: number;
  bbrTempC: number;
  dttTempC: number;
  /** The project's grade (orange column). */
  selected: boolean;
  /** Whether M320 Table 1 lists this high/low combination. */
  inM320: boolean;
}

export interface SpecTable {
  title: string;
  label: string;
  highGrade: number;
  lowGrade: number;
  columns: SpecColumn[];
  selectedIndex: number;
  originalDsrTempC: number;
  rtfoDsrTempC: number;
  pavAgingTempLabel: string;
  /** True when M320 Table 1 lists the selected grade. */
  inM320: boolean;
  limits: typeof SPEC_LIMITS;
}

export function intermediateTestTemp(highGrade: number, lowGrade: number): number {
  return (highGrade + lowGrade) / 2 + 4;
}

export function lowTestTemp(lowGrade: number): number {
  return lowGrade + 10;
}

export function specificationTable(highGrade: number, lowGrade: number): SpecTable {
  const listed = M320_LOW_GRADES[highGrade] ?? [];
  const lows: number[] = [...SPEC_TABLE_LOW_GRADES];
  if (!lows.includes(lowGrade)) lows.push(lowGrade);
  const columns = lows.map((low) => ({
    lowGrade: low,
    pavDsrTempC: intermediateTestTemp(highGrade, low),
    bbrTempC: lowTestTemp(low),
    dttTempC: lowTestTemp(low),
    selected: low === lowGrade,
    inM320: listed.includes(low),
  }));
  const label = gradeLabel(highGrade, lowGrade);
  return {
    title: `Specification for Bitumen with Performance Grade ${label}`,
    label,
    highGrade,
    lowGrade,
    columns,
    selectedIndex: columns.findIndex((c) => c.selected),
    originalDsrTempC: highGrade,
    rtfoDsrTempC: highGrade,
    pavAgingTempLabel: pavAgingTemperatureLabel(highGrade),
    inM320: listed.includes(lowGrade),
    limits: SPEC_LIMITS,
  };
}

export const SPEC_TABLE_NOTE =
  'The highlighted column (orange background) indicates the test temperatures corresponding to the ' +
  'project selected PG grade. All values must meet the specified criteria for the binder to be ' +
  'certified for this performance grade according to AASHTO M320/M332 standards.';

export const DTT_FOOTNOTE =
  'Under AASHTO M320, the direct tension test is needed only when the BBR creep stiffness S is ' +
  'between 300 and 600 MPa (with m ≥ 0.300).';
