/** Uploaded file bytes → sheets of cells → observations. Works in the browser and in Node. */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { fileError } from './errors';
import { extractDataset, ParsedDataset, Sheet } from './extract';
import { Cell } from './values';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 200_000;
const MAX_COLUMNS = 200;

export const ACCEPTED_EXTENSIONS = ['.csv', '.txt', '.tsv', '.xlsx', '.xlsm', '.xls', '.ods'] as const;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

/** Excel / OpenDocument files are recognised by their content, not only by the file name. */
function isSpreadsheet(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || // .xlsx / .xlsm / .ods (zip)
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]) // .xls
  );
}

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  // Files saved by older Excel versions are often Windows-1252, which shows up as replacement characters.
  const text = utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
  return text.replace(/^﻿/, '');
}

function readCsv(bytes: Uint8Array, fileName: string): Sheet[] {
  const text = decodeText(bytes);
  if (text.includes('\u0000')) throw fileError('The file could not be read. Upload a CSV or Excel file.');
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false, delimiter: '' });
  const rows = (result.data as string[][]).slice(0, MAX_ROWS_PER_SHEET).map((r) => r.slice(0, MAX_COLUMNS));
  return [{ name: fileName, rows }];
}

function readWorkbook(bytes: Uint8Array): { sheets: Sheet[]; date1904: boolean } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: false, cellFormula: false, cellHTML: false });
  } catch {
    throw fileError('The file could not be read. Upload a CSV or Excel file.');
  }
  const sheets = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    if (!ws || !ws['!ref']) return { name, rows: [] };
    const range = XLSX.utils.decode_range(ws['!ref']);
    const lastRow = Math.min(range.e.r, range.s.r + MAX_ROWS_PER_SHEET - 1);
    const lastCol = Math.min(range.e.c, range.s.c + MAX_COLUMNS - 1);
    const rows: Cell[][] = [];
    for (let r = range.s.r; r <= lastRow; r++) {
      const row: Cell[] = [];
      for (let c = range.s.c; c <= lastCol; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        row.push(toCell(cell));
      }
      rows.push(row);
    }
    return { name, rows };
  });
  return { sheets, date1904: Boolean(workbook.Workbook?.WBProps?.date1904) };
}

function toCell(cell: XLSX.CellObject | undefined): Cell {
  if (!cell) return null;
  switch (cell.t) {
    case 'n':
      if (typeof cell.v !== 'number') return null;
      return cell.z && XLSX.SSF.is_date(cell.z) ? { excelSerial: cell.v } : cell.v;
    case 'd':
      return cell.v instanceof Date ? cell.v : null;
    case 's':
      return typeof cell.v === 'string' ? cell.v : null;
    case 'b':
      return Boolean(cell.v);
    default:
      return null;
  }
}

/** Reads any supported temperature file. Throws AnalysisError('BAD_FILE') with one plain message. */
export function readTemperatureFile(bytes: Uint8Array, fileName: string): ParsedDataset {
  if (bytes.length === 0) throw fileError('The file is empty.');
  if (bytes.length > MAX_FILE_BYTES) throw fileError('The file is larger than 10 MB. Upload one station at a time.');
  if (isSpreadsheet(bytes)) {
    const { sheets, date1904 } = readWorkbook(bytes);
    return extractDataset(sheets, fileName, date1904);
  }
  return extractDataset(readCsv(bytes, fileName), fileName);
}
