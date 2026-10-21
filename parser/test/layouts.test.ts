import { readTemperatureFile } from '../src';
import { bytes, DAYS, on, xlsxBytes } from './helpers';

const row = (n: number, f: (d: number) => string | number) => Array.from({ length: n }, (_, i) => f(i + 1));

describe('station layout (like TT_Meisso.csv)', () => {
  const jan = row(31, (d) => (d === 3 ? 'X' : (25 + d / 10).toFixed(1)));
  const feb = [...row(28, (d) => (30 + d / 10).toFixed(1)), '', '', ''];
  const tminJan = row(31, (d) => (d === 5 ? 'N/a' : (10 + d / 10).toFixed(1)));
  const csv = [
    '﻿Name,GEOGR2,GEOGR1,ELEVATION,element,Year,Month,Time,' + DAYS.join(',') + ',,',
    `Meiso Mission,9.23,40.756,1329,TMPMAX,2005,1,18:00,${jan.join(',')},,`,
    `Meiso Mission,9.23,40.756,1329,TMPMAX,2005,2,18:00,${feb.join(',')},,`,
    `Meiso Mission,9.23,40.756,1329,TMPMIN,2005,1,18:00,${tminJan.join(',')},,`,
    ',,,,,,,,' + ','.repeat(32),
    'X= NO DATA' + ','.repeat(40),
  ].join('\r\n');
  const parsed = readTemperatureFile(bytes(csv), 'TT_Meisso.csv');

  it('finds the layout and the station details', () => {
    expect(parsed.layout).toBe('wide-days');
    expect(parsed.station).toEqual({ name: 'Meiso Mission', latitude: 9.23, longitude: 40.756, elevation: 1329 });
  });

  it('reads day values; X and N/a are missing; empty 29–31 February cells are skipped', () => {
    expect(on(parsed.observations, 2005, 1, 1, 'tmax')).toBe(25.1);
    expect(on(parsed.observations, 2005, 1, 31, 'tmax')).toBe(28.1);
    expect(on(parsed.observations, 2005, 1, 3, 'tmax')).toBeNull();
    expect(on(parsed.observations, 2005, 1, 5, 'tmin')).toBeNull();
    expect(on(parsed.observations, 2005, 2, 28, 'tmax')).toBe(32.8);
    expect(parsed.observations.filter((o) => o.month === 2)).toHaveLength(28);
    expect(parsed.observations).toHaveLength(31 + 28 + 31);
  });

  it('the note row is skipped and the extra columns are ignored', () => {
    expect(parsed.details.rowsUsed).toBe(3);
    expect(parsed.details.rowsSkipped).toBe(1);
  });
});

describe('daily list: Date, Tmax, Tmin', () => {
  it('semicolon separated, decimal commas, units in the names, extra columns', () => {
    const csv = 'Date;Tmax (°C);Tmin (°C);Rain (mm)\n01/02/2020;27,5;12,1;0\n13/02/2020;30;14;2\n';
    const p = readTemperatureFile(bytes(csv), 'data.csv');
    expect(p.layout).toBe('long');
    expect(p.details.dateOrder).toBe('dmy');
    expect(on(p.observations, 2020, 2, 1, 'tmax')).toBe(27.5);
    expect(on(p.observations, 2020, 2, 13, 'tmin')).toBe(14);
  });

  it('month-first dates are recognised from the column', () => {
    const p = readTemperatureFile(bytes('date,tmax,tmin\n02/13/2020,30,14\n02/14/2020,31,15\n'), 'us.csv');
    expect(p.details.dateOrder).toBe('mdy');
    expect(on(p.observations, 2020, 2, 13, 'tmax')).toBe(30);
  });

  it('columns in any order, other names (TX / TN), with Year, Month, Day', () => {
    const csv = 'Station: Addis Ababa Bole\nLatitude: 8.98\nElevation (m): 2354\n\nTN,DAY,TX,MONTH,YEAR\n8.2,1,24.1,1,2019\n';
    const p = readTemperatureFile(bytes(csv), 'x.csv');
    expect(p.station).toEqual({ name: 'Addis Ababa Bole', latitude: 8.98, longitude: null, elevation: 2354 });
    expect(p.observations).toEqual([{ year: 2019, month: 1, day: 1, tmax: 24.1, tmin: 8.2 }]);
  });

  it('Fahrenheit columns are converted to °C', () => {
    const p = readTemperatureFile(bytes('Date,Tmax (°F),Tmin (°F)\n2020-01-01,86,50\n'), 'f.csv');
    expect(on(p.observations, 2020, 1, 1, 'tmax')).toBeCloseTo(30, 10);
    expect(on(p.observations, 2020, 1, 1, 'tmin')).toBeCloseTo(10, 10);
    expect(p.details.convertedFromFahrenheit).toBe(true);
  });

  it('Excel dates in an Excel file', () => {
    const file = xlsxBytes([
      {
        name: 'Daily',
        rows: [
          ['Date', 'Max Temp', 'Min Temp'],
          [new Date(2020, 1, 29), 33.5, 18],
          [new Date(2020, 2, 1), 34, 19],
        ],
      },
    ]);
    const p = readTemperatureFile(file, 'daily.xlsx');
    expect(p.observations).toEqual([
      { year: 2020, month: 2, day: 29, tmax: 33.5, tmin: 18 },
      { year: 2020, month: 3, day: 1, tmax: 34, tmin: 19 },
    ]);
  });
});

describe('element list: Date, Element, Value', () => {
  it('keeps Tmax and Tmin rows and ignores other elements', () => {
    const csv = 'Date,Element,Value\n2020-01-01,TMPMAX,30\n2020-01-01,TMPMIN,15\n2020-01-01,RAIN,3\n';
    const p = readTemperatureFile(bytes(csv), 'x.csv');
    expect(p.layout).toBe('long-element');
    expect(p.observations).toEqual([
      { year: 2020, month: 1, day: 1, tmax: 30 },
      { year: 2020, month: 1, day: 1, tmin: 15 },
    ]);
    expect(p.details.rowsSkipped).toBe(1);
  });
});

describe('month columns: Year, Day, Jan … Dec in separate Tmax / Tmin sheets', () => {
  const header = ['Year', 'Day', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sheet = (base: number) => [
    ['Station: Dire Dawa'],
    header,
    [2021, 1, ...row(12, (m) => base + m)],
    [2021, 30, base, '', ...row(10, (m) => base + m)],
  ];
  const p = readTemperatureFile(
    xlsxBytes([
      { name: 'Tmax', rows: sheet(30) },
      { name: 'Tmin', rows: sheet(10) },
    ]),
    'diredawa.xlsx',
  );

  it('takes the element from the sheet name', () => {
    expect(p.layout).toBe('wide-months');
    expect(p.details.sheetsUsed).toEqual(['Tmax', 'Tmin']);
    expect(on(p.observations, 2021, 3, 1, 'tmax')).toBe(33);
    expect(on(p.observations, 2021, 3, 1, 'tmin')).toBe(13);
    expect(p.station.name).toBe('Dire Dawa');
  });

  it('skips the empty 30 February cell', () => {
    expect(p.observations.some((o) => o.month === 2 && o.day === 30)).toBe(false);
    expect(on(p.observations, 2021, 1, 30, 'tmax')).toBe(30);
  });
});

describe('two blocks in one sheet with titles instead of an element column', () => {
  it('takes the element from the title above each block', () => {
    const csv = [
      'Daily Maximum Temperature (°C)',
      'Year,Month,' + DAYS.join(','),
      '2020,1,' + row(31, () => 30).join(','),
      '',
      'Daily Minimum Temperature (°C)',
      'Year,Month,' + DAYS.join(','),
      '2020,1,' + row(31, () => 12).join(','),
    ].join('\n');
    const p = readTemperatureFile(bytes(csv), 'blocks.csv');
    expect(on(p.observations, 2020, 1, 15, 'tmax')).toBe(30);
    expect(on(p.observations, 2020, 1, 15, 'tmin')).toBe(12);
    expect(p.observations).toHaveLength(62);
  });

  it('or from the file name when there is no title', () => {
    const tmax = 'Year,Month,' + DAYS.join(',') + '\n2020,1,' + row(31, () => 30).join(',');
    const p = () => readTemperatureFile(bytes(tmax), 'station_tmax.csv');
    // A Tmax-only file is found correctly, then rejected because Tmin is missing.
    expect(p).toThrow('Only maximum temperatures (Tmax) were found.');
  });

  it('month and year in one column ("2020-01")', () => {
    const csv = 'element,Month,' + DAYS.join(',') + '\nTMPMAX,2020-01,' + row(31, () => 30).join(',') +
      '\nTMPMIN,2020-01,' + row(31, () => 10).join(',');
    const p = readTemperatureFile(bytes(csv), 'x.csv');
    expect(on(p.observations, 2020, 1, 31, 'tmin')).toBe(10);
  });
});

describe('no recognisable column names', () => {
  it('finds the date column and the two temperature columns from their values', () => {
    const lines = row(12, (d) => `2020-03-${String(d).padStart(2, '0')},${(14 + d / 10).toFixed(1)},${(31 + d / 10).toFixed(1)}`);
    const p = readTemperatureFile(bytes(['col_a,col_b,col_c', ...lines].join('\n')), 'odd.csv');
    expect(p.layout).toBe('auto-columns');
    // The warmer column is Tmax.
    expect(on(p.observations, 2020, 3, 1, 'tmax')).toBe(31.1);
    expect(on(p.observations, 2020, 3, 1, 'tmin')).toBe(14.1);
  });
});
