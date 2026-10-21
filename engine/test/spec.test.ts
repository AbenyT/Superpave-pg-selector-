import { pavAgingTemperatureLabel, specificationTable } from '../src';

const cols = (high: number, low: number, key: 'lowGrade' | 'pavDsrTempC' | 'bbrTempC' | 'dttTempC') =>
  specificationTable(high, low).columns.map((c) => c[key]);

describe('PG 70-10 matches the reference table image', () => {
  const t = specificationTable(70, -10);

  it('title and label', () => {
    expect(t.title).toBe('Specification for Bitumen with Performance Grade PG 70-10');
    expect(t.label).toBe('PG 70-10');
  });

  it('low-grade columns, selected column first', () => {
    expect(cols(70, -10, 'lowGrade')).toEqual([-10, -16, -22, -28, -34, -40]);
    expect(t.selectedIndex).toBe(0);
    expect(t.columns.filter((c) => c.selected)).toHaveLength(1);
  });

  it('DSR temperatures for original binder and RTFO', () => {
    expect(t.originalDsrTempC).toBe(70);
    expect(t.rtfoDsrTempC).toBe(70);
  });

  it('PAV intermediate temperatures 34, 31, 28, 25, 22, 19', () => {
    expect(cols(70, -10, 'pavDsrTempC')).toEqual([34, 31, 28, 25, 22, 19]);
  });

  it('BBR and DTT temperatures 0, −6, −12, −18, −24, −30', () => {
    expect(cols(70, -10, 'bbrTempC')).toEqual([0, -6, -12, -18, -24, -30]);
    expect(cols(70, -10, 'dttTempC')).toEqual([0, -6, -12, -18, -24, -30]);
  });

  it('PAV ageing 100 (110) °C, fixed limits', () => {
    expect(t.pavAgingTempLabel).toBe('100 (110)');
    expect(t.limits).toMatchObject({
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
    });
    expect(t.inM320).toBe(true);
  });
});

describe('other grades', () => {
  it('PG 64-22', () => {
    const t = specificationTable(64, -22);
    expect(t.selectedIndex).toBe(2);
    expect(t.originalDsrTempC).toBe(64);
    expect(cols(64, -22, 'pavDsrTempC')).toEqual([31, 28, 25, 22, 19, 16]);
    expect(t.columns[2]).toMatchObject({ pavDsrTempC: 25, bbrTempC: -12, dttTempC: -12 });
    expect(t.pavAgingTempLabel).toBe('100');
  });

  it('PG 58-28', () => {
    const t = specificationTable(58, -28);
    expect(t.columns[t.selectedIndex]).toMatchObject({ lowGrade: -28, pavDsrTempC: 19, bbrTempC: -18 });
    expect(t.pavAgingTempLabel).toBe('100');
  });

  it('PG 76-16', () => {
    const t = specificationTable(76, -16);
    expect(cols(76, -16, 'pavDsrTempC')).toEqual([37, 34, 31, 28, 25, 22]);
    expect(t.columns[t.selectedIndex].bbrTempC).toBe(-6);
  });

  it('PG 82-10 and PG 88-10 intermediate temperatures', () => {
    expect(specificationTable(82, -10).columns[0].pavDsrTempC).toBe(40);
    expect(specificationTable(88, -10).columns[0].pavDsrTempC).toBe(43);
  });

  it('PG 52-46 adds a 7th column and selects it', () => {
    const t = specificationTable(52, -46);
    expect(cols(52, -46, 'lowGrade')).toEqual([-10, -16, -22, -28, -34, -40, -46]);
    expect(t.selectedIndex).toBe(6);
    expect(t.columns[6]).toMatchObject({ pavDsrTempC: 7, bbrTempC: -36, dttTempC: -36 });
    expect(t.pavAgingTempLabel).toBe('90');
  });

  it('every PAV temperature equals (high + low) / 2 + 4 and every BBR/DTT temperature equals low + 10', () => {
    for (const high of [46, 52, 58, 64, 70, 76, 82, 88]) {
      for (const low of [-10, -16, -22, -28, -34, -40, -46]) {
        for (const c of specificationTable(high, low).columns) {
          expect(c.pavDsrTempC).toBe((high + c.lowGrade) / 2 + 4);
          expect(Number.isInteger(c.pavDsrTempC)).toBe(true);
          expect(c.bbrTempC).toBe(c.lowGrade + 10);
          expect(c.dttTempC).toBe(c.lowGrade + 10);
        }
      }
    }
  });
});

describe('grades not listed in M320 Table 1', () => {
  it.each([
    [58, -10, false],
    [58, -16, true],
    [76, -40, false],
    [76, -34, true],
    [46, -10, false],
    [46, -34, true],
    [88, -10, false],
  ])('PG %p%p listed: %p', (high, low, listed) => {
    expect(specificationTable(high, low).inM320).toBe(listed);
  });
});

describe('PAV ageing temperature by high grade', () => {
  it.each([
    [46, '90'],
    [52, '90'],
    [58, '100'],
    [64, '100'],
    [70, '100 (110)'],
    [76, '100 (110)'],
    [82, '100 (110)'],
    [88, '100 (110)'],
  ])('PG %p → %p °C', (high, label) => {
    expect(pavAgingTemperatureLabel(high)).toBe(label);
  });
});
