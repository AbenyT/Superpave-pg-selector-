import { readTemperatureFile, templateCsvDaily, templateWorkbook } from '../src';
import { bytes } from './helpers';

describe('download templates', () => {
  it('the Excel template reads back (the Instructions sheet is ignored)', () => {
    const p = readTemperatureFile(templateWorkbook(), 'PG_template.xlsx');
    expect(p.layout).toBe('wide-days');
    expect(p.details.sheetsUsed).toEqual(['Data']);
    expect(p.station).toMatchObject({ name: 'My Station', latitude: 9.23 });
    expect(p.observations).toHaveLength(62);
  });

  it('the CSV template reads back', () => {
    const p = readTemperatureFile(bytes(templateCsvDaily()), 'PG_template_daily.csv');
    expect(p.layout).toBe('long');
    expect(p.observations).toHaveLength(5);
    expect(p.observations[0]).toEqual({ year: 2024, month: 1, day: 1, tmax: 27, tmin: 11.5 });
  });
});
