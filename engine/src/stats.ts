export function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n − 1), the same as pandas `.std()` in the notebook. */
export function sampleStandardDeviation(values: readonly number[]): number {
  const m = mean(values);
  const squares = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}
