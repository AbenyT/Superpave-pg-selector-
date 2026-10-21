import * as XLSX from 'xlsx';
import { Observation } from '@pg/engine';

export function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function xlsxBytes(sheets: { name: string; rows: unknown[][] }[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows, { cellDates: true }), s.name);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Observation for one date, or undefined. */
export function on(obs: Observation[], year: number, month: number, day: number, field: 'tmax' | 'tmin') {
  return obs.find((o) => o.year === year && o.month === month && o.day === day && o[field] !== undefined)?.[field];
}
