/** Cell values as they come out of CSV or Excel files. */

/** An Excel cell that holds a date (stored by Excel as a day serial number). */
export interface ExcelDate {
  excelSerial: number;
}

export type Cell = string | number | boolean | Date | ExcelDate | null | undefined;

export function isExcelDate(cell: Cell): cell is ExcelDate {
  return typeof cell === 'object' && cell !== null && !(cell instanceof Date) && 'excelSerial' in cell;
}

export function isBlank(cell: Cell): boolean {
  return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');
}

export function cellText(cell: Cell): string {
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  return '';
}

/**
 * Comparison key for a column name or label: lower case, letters and digits only,
 * with units and anything in brackets removed. "Tmax (°C)" → "tmax", "Max. Temp °C" → "maxtemp".
 */
export function textKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/°\s*[cf]\b|\bdeg(?:rees?)?\s*[cf]\b|\bcelsius\b|\bfahrenheit\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

/** True if the text says the values are in degrees Fahrenheit. */
export function mentionsFahrenheit(text: string): boolean {
  return /°\s*f\b|\(\s*f\s*\)|\[\s*f\s*\]|\bdeg(?:rees?)?\s*f\b|fahrenheit/i.test(text);
}

const NUMBER = /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(?:°\s*[cf]?|[*#a-z]{0,2})$/i;

/**
 * A temperature or other number from a cell, or null when the cell holds no number
 * ("", "X", "N/a", "-", "missing", …). Accepts decimal commas ("27,5") and
 * small flags after the number ("32.4*", "28.0E").
 */
export function toNumber(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string') return null;
  const s = cell.trim().replace(/[−–]/g, '-');
  const m = NUMBER.exec(s);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function toInteger(cell: Cell): number | null {
  const n = toNumber(cell);
  return n !== null && Number.isInteger(n) ? n : null;
}
