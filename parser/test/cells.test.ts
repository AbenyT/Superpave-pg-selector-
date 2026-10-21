import {
  classifyHeader,
  detectDateOrder,
  elementFromName,
  elementFromText,
  excelSerialToDate,
  parseDateCell,
  parseYearMonthCell,
  textKey,
  toNumber,
} from '../src';

describe('numbers in cells', () => {
  it.each([
    [27, 27],
    ['27', 27],
    [' 31.2 ', 31.2],
    ['27,5', 27.5],
    ['-3.5', -3.5],
    ['−3.5', -3.5],
    ['.5', 0.5],
    ['32.4*', 32.4],
    ['28.0E', 28],
    ['30°C', 30],
    ['30 °C', 30],
  ])('%p → %p', (cell, n) => {
    expect(toNumber(cell)).toBe(n);
  });

  it.each(['', 'X', 'x', 'N/a', 'NA', '-', '--', 'missing', 'trace', '12:00', null, undefined, true, NaN])(
    '%p → missing',
    (cell) => {
      expect(toNumber(cell as never)).toBeNull();
    },
  );
});

describe('column names', () => {
  it.each([
    ['Name', 'station'],
    ['Station Name', 'station'],
    ['GEOGR2', 'latitude'],
    ['Latitude (°N)', 'latitude'],
    ['GEOGR1', 'longitude'],
    ['ELEVATION', 'elevation'],
    ['element', 'element'],
    ['Variable', 'element'],
    ['Year', 'year'],
    ['YYYY', 'year'],
    ['Month', 'month'],
    ['Day', 'day'],
    ['Date', 'date'],
    ['Tmax', 'tmax'],
    ['TMPMAX', 'tmax'],
    ['Tmax (°C)', 'tmax'],
    ['Max. Temp °C', 'tmax'],
    ['Maximum Temperature', 'tmax'],
    ['Daily maximum air temperature [C]', 'tmax'],
    ['TX', 'tmax'],
    ['Tmin', 'tmin'],
    ['TN', 'tmin'],
    ['Min Temp', 'tmin'],
    ['Value', 'value'],
  ])('%p → %p', (text, role) => {
    expect(classifyHeader(text).role).toBe(role);
  });

  it.each([
    ['1', 1],
    [1, 1],
    ['31', 31],
    ['Day 7', 7],
    ['D07', 7],
    ['1st', 1],
  ])('day column %p → %p', (text, day) => {
    expect(classifyHeader(text).dayOfMonth).toBe(day);
  });

  it.each([
    ['Jan', 1],
    ['February', 2],
    ['Sept', 9],
    ['DEC', 12],
  ])('month column %p → %p', (text, month) => {
    expect(classifyHeader(text).monthOfYear).toBe(month);
  });

  it.each(['Time', 'Rain (mm)', 'RH', '32', 'Minutes', 'Comment'])('%p is not a needed column', (text) => {
    const h = classifyHeader(text);
    expect(h.role).toBeUndefined();
    expect(h.dayOfMonth).toBeUndefined();
  });

  it('spots Fahrenheit units', () => {
    expect(classifyHeader('Tmax (°F)').fahrenheit).toBe(true);
    expect(classifyHeader('Tmax (°C)').fahrenheit).toBe(false);
  });

  it('textKey strips units and punctuation', () => {
    expect(textKey('Tmax (°C)')).toBe('tmax');
    expect(textKey('Max. Temp °C')).toBe('maxtemp');
  });
});

describe('element names in cells, sheet names and titles', () => {
  it.each([
    ['TMPMAX', 'tmax'],
    ['tmax', 'tmax'],
    ['Max', 'tmax'],
    ['Tmax 2005-2024', 'tmax'],
    ['Daily Maximum Temperature (°C)', 'tmax'],
    ['TMPMIN', 'tmin'],
    ['Minimum temperature', 'tmin'],
    ['RAINFALL', null],
    ['RH', null],
    ['Sheet1', null],
    ['Meiso', null],
    ['', null],
  ])('%p → %p', (text, element) => {
    expect(elementFromText(text)).toBe(element);
  });
});

describe('element from sheet and file names', () => {
  it.each([
    ['station_tmax', 'tmax'],
    ['Meisso TN 2024', 'tmin'],
    ['Max Temp', 'tmax'],
    ['Data', null],
  ])('%p → %p', (text, element) => {
    expect(elementFromName(text)).toBe(element);
  });
});

describe('dates', () => {
  it('Excel serial numbers (1900 and 1904 systems)', () => {
    expect(excelSerialToDate(38353)).toEqual({ year: 2005, month: 1, day: 1 });
    expect(excelSerialToDate(43890)).toEqual({ year: 2020, month: 2, day: 29 });
    expect(excelSerialToDate(1)).toEqual({ year: 1900, month: 1, day: 1 });
    expect(excelSerialToDate(36891, true)).toEqual({ year: 2005, month: 1, day: 1 });
    expect(excelSerialToDate(38353.75)).toEqual({ year: 2005, month: 1, day: 1 }); // time of day ignored
  });

  it.each([
    ['2005-01-31', { year: 2005, month: 1, day: 31 }],
    ['2005/1/31', { year: 2005, month: 1, day: 31 }],
    ['2005-01-31 18:00:00', { year: 2005, month: 1, day: 31 }],
    ['2005-01-31T00:00', { year: 2005, month: 1, day: 31 }],
    ['20050131', { year: 2005, month: 1, day: 31 }],
    [20050131, { year: 2005, month: 1, day: 31 }],
    ['31/01/2005', { year: 2005, month: 1, day: 31 }],
    ['31.01.2005', { year: 2005, month: 1, day: 31 }],
    ['31-01-05', { year: 2005, month: 1, day: 31 }],
    ['31-Jan-2005', { year: 2005, month: 1, day: 31 }],
    ['31 January 2005', { year: 2005, month: 1, day: 31 }],
    ['Jan 31, 2005', { year: 2005, month: 1, day: 31 }],
    [{ excelSerial: 38383 }, { year: 2005, month: 1, day: 31 }],
  ])('%p', (cell, date) => {
    expect(parseDateCell(cell as never)).toEqual(date);
  });

  it('05/03/2015 is read day first unless the column shows month first', () => {
    expect(detectDateOrder(['05/03/2015', '13/03/2015'])).toBe('dmy');
    expect(detectDateOrder(['05/03/2015', '06/03/2015'])).toBe('dmy');
    expect(detectDateOrder(['03/05/2015', '03/13/2015'])).toBe('mdy');
    expect(parseDateCell('03/13/2015', 'mdy')).toEqual({ year: 2015, month: 3, day: 13 });
  });

  it('impossible dates are returned as written (the engine rejects them)', () => {
    expect(parseDateCell('2021-02-30')).toEqual({ year: 2021, month: 2, day: 30 });
  });

  it('a plain number in a date column is an Excel day number', () => {
    expect(parseDateCell(38353)).toEqual({ year: 2005, month: 1, day: 1 });
  });

  it.each(['', 'abc', '2005', '12:00', null])('%p is not a date', (cell) => {
    expect(parseDateCell(cell as never)).toBeNull();
  });

  it.each([
    ['2005-01', { year: 2005, month: 1 }],
    ['01/2005', { year: 2005, month: 1 }],
    ['Jan 2005', { year: 2005, month: 1 }],
    ['2005 March', { year: 2005, month: 3 }],
    [{ excelSerial: 38353 }, { year: 2005, month: 1 }],
  ])('year and month from %p', (cell, ym) => {
    expect(parseYearMonthCell(cell as never)).toEqual(ym);
  });
});
