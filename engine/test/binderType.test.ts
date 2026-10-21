import { BINDER_MATRIX, BINDER_MATRIX_HIGH, BINDER_MATRIX_LOW, binderType } from '../src';

describe('binder type chart (crude oil blends)', () => {
  // The user's chart, row by row (low −10 … −40), 1 = crude oil, 2 = high-quality crude oil, 3 = modifier required.
  const chart: Record<number, number[]> = {
    46: [1, 1, 1, 1, 1, 2],
    52: [1, 1, 1, 1, 2, 3],
    58: [1, 1, 1, 2, 2, 3],
    64: [1, 1, 1, 2, 3, 3],
    70: [1, 1, 2, 3, 3, 3],
    76: [1, 2, 3, 3, 3, 3],
  };

  it.each(Object.entries(chart))('PG %s row matches the chart', (high, row) => {
    row.forEach((code, i) => {
      expect(binderType(Number(high), BINDER_MATRIX_LOW[i]).code).toBe(code);
    });
  });

  it('covers PG 46 … 88', () => {
    expect([...BINDER_MATRIX_HIGH]).toEqual([46, 52, 58, 64, 70, 76, 82, 88]);
    for (const h of BINDER_MATRIX_HIGH) expect(BINDER_MATRIX[h]).toHaveLength(6);
  });

  it.each([
    [70, -10, 'Crude oil'],
    [70, -22, 'High-quality crude oil'],
    [76, -16, 'High-quality crude oil'],
    [76, -22, 'Modifier required'],
    [82, -10, 'High-quality crude oil'],
    [88, -10, 'Modifier required'],
  ])('PG %p%p → %p', (high, low, name) => {
    expect(binderType(high, low)).toMatchObject({ name, fromChart: true });
  });

  it('grades outside the chart use the fallback rule', () => {
    expect(binderType(52, -46)).toMatchObject({ code: 3, fromChart: false });
  });

  it('rule of 90: high + |low|', () => {
    expect(binderType(70, -10)).toMatchObject({ temperatureSum: 80, ruleOf90SaysModified: false });
    expect(binderType(76, -22)).toMatchObject({ temperatureSum: 98, ruleOf90SaysModified: true });
    expect(binderType(64, -28)).toMatchObject({ temperatureSum: 92, ruleOf90SaysModified: true });
    expect(binderType(58, -28)).toMatchObject({ temperatureSum: 86, ruleOf90SaysModified: false });
  });
});
