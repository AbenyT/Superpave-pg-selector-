import { AnalysisError } from '@pg/engine';
import { MAX_FILE_BYTES, readTemperatureFile } from '../src';
import { bytes, DAYS } from './helpers';

function messageOf(file: Uint8Array, name = 'x.csv'): string {
  try {
    readTemperatureFile(file, name);
  } catch (e) {
    expect(e).toBeInstanceOf(AnalysisError);
    expect((e as AnalysisError).code).toBe('BAD_FILE');
    return (e as AnalysisError).message;
  }
  throw new Error('expected an error');
}

describe('one plain message for an unusable file', () => {
  it('empty file', () => {
    expect(messageOf(new Uint8Array())).toBe('The file is empty.');
  });

  it('too large', () => {
    expect(messageOf(new Uint8Array(MAX_FILE_BYTES + 1).fill(65))).toMatch(/larger than 10 MB/);
  });

  it('broken Excel file', () => {
    expect(messageOf(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]), 'x.xlsx')).toMatch(/could not be read/);
  });

  it('nothing that looks like temperature data', () => {
    expect(messageOf(bytes('foo,bar\nhello,world\n'))).toMatch(/^The temperature data could not be found in this file/);
  });

  it('more than one station', () => {
    const csv = 'Name,element,Year,Month,' + DAYS.join(',') + '\n' +
      'A,TMPMAX,2020,1,' + DAYS.map(() => 30).join(',') + '\n' +
      'B,TMPMIN,2020,1,' + DAYS.map(() => 10).join(',');
    expect(messageOf(bytes(csv))).toBe('The file has more than one station (A, B). Upload one station per file.');
  });

  it('only Tmin', () => {
    expect(messageOf(bytes('Date,Tmin\n2020-01-01,10\n'))).toBe(
      'Only minimum temperatures (Tmin) were found. The file also needs maximum temperatures (Tmax).',
    );
  });

  it('element column without temperatures', () => {
    expect(messageOf(bytes('Date,Element,Value\n2020-01-01,RAIN,3\n2020-01-01,RH,60\n'))).toBe(
      'No TMPMAX or TMPMIN rows were found in the element column (found: RAIN, RH).',
    );
  });

  it('day columns but no way to tell Tmax from Tmin', () => {
    const csv = 'Year,Month,' + DAYS.join(',') + '\n2020,1,' + DAYS.map(() => 30).join(',');
    expect(messageOf(bytes(csv), 'data.csv')).toMatch(/^Could not tell whether the values are maximum or minimum/);
  });

  it('dates with more than two unnamed number columns', () => {
    const lines = Array.from({ length: 12 }, (_, i) => `2020-01-${String(i + 1).padStart(2, '0')},30.5,12.5,20.5`);
    expect(messageOf(bytes(['a,b,c,d', ...lines].join('\n')))).toBe(
      'The file has more than two number columns. Name the temperature columns Tmax and Tmin.',
    );
  });

  it('all values blank', () => {
    expect(messageOf(bytes('Date,Tmax,Tmin\n2020-01-01,X,X\n'))).toBe('The file has no temperature values.');
  });
});
