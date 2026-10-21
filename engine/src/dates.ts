/**
 * Calendar helpers. Dates are handled as whole "day numbers" (days since
 * 1970-01-01, UTC) so that time zones and daylight saving can never shift a day.
 */

const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** True for a real Gregorian date, e.g. false for 30 February or 31 April. */
export function isValidDate(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1800 &&
    year <= 2200 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function toDayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function fromDayNumber(dayNumber: number): CalendarDate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** ISO date text, e.g. "2022-05-19". */
export function formatIsoDate(dayNumber: number): string {
  const { year, month, day } = fromDayNumber(dayNumber);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
