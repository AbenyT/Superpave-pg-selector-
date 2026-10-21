/**
 * Binder type needed for a PG grade (crude oil blends): the user's classification chart
 * ("Prediction of Superpave PG grades for different crude oil blends"), PG 46–76 × −10…−40,
 * with PG 82 / 88 taken from the user's notebook. Grades outside the chart (e.g. −46) use the
 * notebook's fallback rule.
 */

export type BinderTypeCode = 1 | 2 | 3;

export const BINDER_TYPES: Record<BinderTypeCode, { name: string; description: string }> = {
  1: { name: 'Crude oil', description: 'Standard unmodified (neat) binder from ordinary crude oil' },
  2: { name: 'High-quality crude oil', description: 'Unmodified binder from selected, high-quality crude sources' },
  3: { name: 'Modifier required', description: 'Polymer-modified binder (e.g. SBS) is needed' },
};

export const BINDER_MATRIX_HIGH = [46, 52, 58, 64, 70, 76, 82, 88] as const;
export const BINDER_MATRIX_LOW = [-10, -16, -22, -28, -34, -40] as const;

/** BINDER_MATRIX[high][index of low in BINDER_MATRIX_LOW]. */
export const BINDER_MATRIX: Record<number, readonly BinderTypeCode[]> = {
  46: [1, 1, 1, 1, 1, 2],
  52: [1, 1, 1, 1, 2, 3],
  58: [1, 1, 1, 2, 2, 3],
  64: [1, 1, 1, 2, 3, 3],
  70: [1, 1, 2, 3, 3, 3],
  76: [1, 2, 3, 3, 3, 3],
  82: [2, 3, 3, 3, 3, 3],
  88: [3, 3, 3, 3, 3, 3],
};

/** "Rule of 90": if high + |low| exceeds this, the binder is likely polymer-modified. */
export const RULE_OF_90 = 90;
