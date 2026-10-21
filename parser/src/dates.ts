/** Reads dates written in the usual ways: Excel dates, 2005-01-31, 31/01/2005, 20050131, 31-Jan-2005, … */

import { CalendarDate, fromDayNumber } from '@pg/engine';
import { monthFromName } from './headers';
import { Cell, isExcelDate } from './values';

/** Order of day and month in dates like 05/03/2015. */
export type DateOrder = 'dmy' | 'mdy';

/** Excel serial day number → calendar date (1900 date system unless `date1904`). */
export function excelSerialToDate(serial: number, date1904 = false): CalendarDate | null {
  let s = Math.floor(serial);
  if (date1904) s += 1462;
  if (s < 1 || s > 2958465) return null;
  // Excel counts a 29 February 1900 that never existed (serial 60).
  if (s === 60) return { year: 1900, month: 2, day: 29 };
  return fromDayNumber(s > 60 ? s - 25569 : s - 25568);
}

const TIME_SUFFIX = /(?:[T\s]+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:am|pm)?)$/i;
const ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const COMPACT = /^(\d{4})(\d{2})(\d{2})$/;
const NUMERIC_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/;

function fullYear(text: string): number {
  const y = Number(text);
  if (text.length === 4) return y;
  return y < 50 ? 2000 + y : 1900 + y;
}

function fromCompactNumber(n: number): CalendarDate | null {
  if (!Number.isInteger(n) || n < 18000101 || n > 22001231) return null;
  return { year: Math.floor(n / 10000), month: Math.floor(n / 100) % 100, day: n % 100 };
}

/** Looks at all text dates of a column to tell 31/01/2005 (day first) from 01/31/2005 (month first). */
export function detectDateOrder(cells: readonly Cell[]): DateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const cell of cells) {
    if (typeof cell !== 'string') continue;
    const m = NUMERIC_DMY.exec(cell.trim().replace(TIME_SUFFIX, ''));
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  // Day first is the default (Ethiopian and European habit), unless only month-first dates make sense.
  return monthFirst && !dayFirst ? 'mdy' : 'dmy';
}

/**
 * The calendar date in a cell, or null. The date may still be impossible
 * (e.g. 30 February); the engine rejects those and counts them.
 */
export function parseDateCell(cell: Cell, order: DateOrder = 'dmy', date1904 = false): CalendarDate | null {
  if (isExcelDate(cell)) return excelSerialToDate(cell.excelSerial, date1904);
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    return { year: cell.getFullYear(), month: cell.getMonth() + 1, day: cell.getDate() };
  }
  if (typeof cell === 'number') return fromCompactNumber(cell) ?? excelSerialToDate(cell, date1904);
  if (typeof cell !== 'string') return null;

  const s = cell.trim().replace(TIME_SUFFIX, '').trim();
  let m = ISO.exec(s);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = COMPACT.exec(s);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = NUMERIC_DMY.exec(s);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const year = fullYear(m[3]);
    return order === 'mdy' ? { year, month: a, day: b } : { year, month: b, day: a };
  }
  return parseWordDate(s);
}

/** "31-Jan-2005", "31 January 2005", "Jan 31, 2005". */
function parseWordDate(s: string): CalendarDate | null {
  const tokens = s.split(/[\s,\-/.]+/).filter(Boolean);
  if (tokens.length !== 3) return null;
  let month: number | null = null;
  let year: number | null = null;
  let day: number | null = null;
  for (const t of tokens) {
    const name = /^[a-z]+$/i.test(t) ? monthFromName(t) : null;
    if (name !== null && month === null) month = name;
    else if (/^\d{4}$/.test(t) && year === null) year = Number(t);
    else if (/^\d{1,2}$/.test(t) && day === null) day = Number(t);
    else return null;
  }
  return month !== null && year !== null && day !== null ? { year, month, day } : null;
}

/** Year and month from a cell like "2005-01", "01/2005", "Jan 2005" or a date. */
export function parseYearMonthCell(cell: Cell, date1904 = false): { year: number; month: number } | null {
  if (typeof cell === 'string') {
    const s = cell.trim();
    let m = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
    if (m) return { year: Number(m[1]), month: Number(m[2]) };
    m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
    if (m) return { year: Number(m[2]), month: Number(m[1]) };
    const tokens = s.split(/[\s,\-/.]+/).filter(Boolean);
    if (tokens.length === 2) {
      const [a, b] = tokens;
      const month = monthFromName(/^\d/.test(a) ? b : a);
      const year = /^\d{4}$/.test(a) ? Number(a) : /^\d{4}$/.test(b) ? Number(b) : null;
      if (month !== null && year !== null) return { year, month };
    }
  }
  const d = parseDateCell(cell, 'dmy', date1904);
  return d ? { year: d.year, month: d.month } : null;
}

/** True for cells that clearly hold a date (used when a file has no column names). */
export function looksLikeDate(cell: Cell): boolean {
  if (isExcelDate(cell) || cell instanceof Date) return true;
  if (typeof cell === 'number') return fromCompactNumber(cell) !== null;
  if (typeof cell !== 'string') return false;
  const s = cell.trim().replace(TIME_SUFFIX, '').trim();
  return ISO.test(s) || COMPACT.test(s) || NUMERIC_DMY.test(s) || parseWordDate(s) !== null;
}
