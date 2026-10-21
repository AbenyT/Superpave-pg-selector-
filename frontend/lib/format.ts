/** Number and date formatting (true minus sign, fixed decimals). */

export function num(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('-', '−');
}

export function temp(v: number, decimals = 1): string {
  return `${num(v, decimals)} °C`;
}

/** Grade class with a true minus sign, e.g. −10. */
export function signed(v: number): string {
  return String(v).replace('-', '−');
}

/** Grade names keep the usual hyphen: "PG 70-10". */
export function gradeText(label: string): string {
  return label;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = MONTHS;

/** "2022-05-19" → "19 May 2022". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2022-05-19" → "19 May". */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Reads a number typed by the user, accepting a decimal comma; null when it is not a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

export function percent(fraction: number): string {
  return `${Math.floor(fraction * 1000) / 10}%`;
}
