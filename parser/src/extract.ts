/**
 * Finds the temperature table(s) in a spreadsheet and turns them into engine observations.
 *
 * Layouts recognised from the column names (any order, extra columns ignored):
 *   wide-days    Year, Month, 1 … 31 (+ Element, or the element from a sheet name / title)
 *   wide-months  Year, Day, Jan … Dec (+ Element, or the element from a sheet name / title)
 *   long         Date (or Year, Month, Day), Tmax and/or Tmin
 *   long-element Date (or Year, Month, Day), Element, Value
 * If no column names are recognised anywhere, the date column and the two
 * temperature columns are found from the values themselves ('auto-columns').
 */

import { Element, Observation } from '@pg/engine';
import { DateOrder, detectDateOrder, looksLikeDate, parseDateCell, parseYearMonthCell } from './dates';
import { fileError } from './errors';
import { classifyHeader, elementFromName, elementFromText, Role } from './headers';
import { Cell, cellText, isBlank, mentionsFahrenheit, toInteger, toNumber } from './values';

export type Layout = 'wide-days' | 'wide-months' | 'long' | 'long-element' | 'auto-columns';

export interface Sheet {
  name: string;
  rows: Cell[][];
}

export interface StationInfo {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
}

export interface ParsedDataset {
  layout: Layout;
  station: StationInfo;
  observations: Observation[];
  /** Background information only; never shown on the page. */
  details: {
    sheetsUsed: string[];
    rowsUsed: number;
    rowsSkipped: number;
    convertedFromFahrenheit: boolean;
    dateOrder: DateOrder | null;
  };
}

interface ColumnMap {
  roles: Partial<Record<Role, number>>;
  days: Map<number, number>;
  months: Map<number, number>;
  fahrenheit: Set<number>;
}

const HEADER_SCAN_LIMIT = 200_000;

function mapColumns(row: readonly Cell[]): ColumnMap {
  const map: ColumnMap = { roles: {}, days: new Map(), months: new Map(), fahrenheit: new Set() };
  row.forEach((cell, col) => {
    const info = classifyHeader(cell);
    if (info.fahrenheit) map.fahrenheit.add(col);
    if (info.role && map.roles[info.role] === undefined) map.roles[info.role] = col;
    if (info.dayOfMonth && !map.days.has(info.dayOfMonth)) map.days.set(info.dayOfMonth, col);
    if (info.monthOfYear && !map.months.has(info.monthOfYear)) map.months.set(info.monthOfYear, col);
  });
  return map;
}

function hasDate(m: ColumnMap): boolean {
  const r = m.roles;
  return r.date !== undefined || (r.year !== undefined && r.month !== undefined && r.day !== undefined);
}

function layoutOf(m: ColumnMap): Layout | null {
  const r = m.roles;
  if (m.days.size >= 28 && ((r.year !== undefined && r.month !== undefined) || r.date !== undefined || r.month !== undefined)) {
    return 'wide-days';
  }
  if (m.months.size === 12 && r.year !== undefined && r.day !== undefined) return 'wide-months';
  if (hasDate(m) && (r.tmax !== undefined || r.tmin !== undefined)) return 'long';
  if (hasDate(m) && r.element !== undefined && r.value !== undefined) return 'long-element';
  return null;
}

function score(m: ColumnMap): number {
  return Object.keys(m.roles).length + m.days.size + m.months.size;
}

interface Block {
  headerRow: number;
  endRow: number; // exclusive
  map: ColumnMap;
  layout: Layout;
}

/** Header rows of one layout in a sheet; each starts a block that runs to the next header. */
function findBlocks(rows: readonly Cell[][]): Block[] {
  const found: { row: number; map: ColumnMap; layout: Layout }[] = [];
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row || row.every(isBlank)) continue;
    const map = mapColumns(row);
    const layout = layoutOf(map);
    if (layout) found.push({ row: i, map, layout });
  }
  if (found.length === 0) return [];
  const best = found.reduce((a, b) => (score(b.map) > score(a.map) ? b : a));
  const same = found.filter((f) => f.layout === best.layout);
  return same.map((f, i) => ({
    headerRow: f.row,
    endRow: i + 1 < same.length ? same[i + 1].row : rows.length,
    map: f.map,
    layout: f.layout,
  }));
}

/** Text in the few non-empty rows above a header (titles such as "Maximum Temperature (°C)"). */
function titleTextAbove(rows: readonly Cell[][], headerRow: number, stopRow: number): string {
  const parts: string[] = [];
  for (let i = headerRow - 1; i >= Math.max(stopRow, headerRow - 5); i--) {
    for (const cell of rows[i] ?? []) if (typeof cell === 'string' && cell.trim()) parts.push(cell.trim());
  }
  return parts.join(' ');
}

function elementFromTitle(text: string): Element | null {
  for (const part of text.split(/\s{2,}|[|;]/)) {
    const e = elementFromText(part);
    if (e) return e;
  }
  return elementFromText(text);
}

/** "Station: Meiso", "Latitude | 9.23" style lines above the table. */
function metadataAbove(rows: readonly Cell[][], headerRow: number, station: StationInfo): void {
  for (let i = 0; i < headerRow; i++) {
    const row = rows[i] ?? [];
    row.forEach((cell, c) => {
      const text = cellText(cell);
      if (!text) return;
      let label = text;
      let value: Cell = row[c + 1];
      const colon = text.indexOf(':');
      if (colon > 0) {
        label = text.slice(0, colon);
        const rest = text.slice(colon + 1).trim();
        if (rest) value = rest;
      }
      const role = classifyHeader(label).role;
      if (role === 'station' && station.name === null && cellText(value)) station.name = cellText(value);
      if (role === 'latitude') station.latitude ??= validCoordinate(toNumber(value), 90);
      if (role === 'longitude') station.longitude ??= validCoordinate(toNumber(value), 180);
      if (role === 'elevation') station.elevation ??= toNumber(value);
    });
  }
}

function validCoordinate(n: number | null, max: number): number | null {
  return n !== null && Math.abs(n) <= max ? n : null;
}

function fullYear(n: number | null): number | null {
  if (n === null) return null;
  if (n >= 0 && n < 100) return n < 50 ? 2000 + n : 1900 + n;
  return n;
}

function fahrenheitToCelsius(v: number): number {
  return ((v - 32) * 5) / 9;
}

interface Collector {
  observations: Observation[];
  stationNames: Set<string>;
  station: StationInfo;
  rowsUsed: number;
  rowsSkipped: number;
  fahrenheit: boolean;
  dateOrder: DateOrder | null;
  unknownElements: Set<string>;
}

function readStationColumns(row: readonly Cell[], m: ColumnMap, out: Collector): void {
  const r = m.roles;
  if (r.station !== undefined) {
    const name = cellText(row[r.station]);
    if (name) out.stationNames.add(name);
  }
  if (r.latitude !== undefined) out.station.latitude ??= validCoordinate(toNumber(row[r.latitude]), 90);
  if (r.longitude !== undefined) out.station.longitude ??= validCoordinate(toNumber(row[r.longitude]), 180);
  if (r.elevation !== undefined) out.station.elevation ??= toNumber(row[r.elevation]);
}

function rowElement(row: readonly Cell[], m: ColumnMap, fallback: Element | null, out: Collector): Element | null {
  if (m.roles.element === undefined) return fallback;
  const text = cellText(row[m.roles.element]);
  const element = elementFromText(text);
  if (!element && text) out.unknownElements.add(text);
  return element;
}

function rowDate(
  row: readonly Cell[],
  m: ColumnMap,
  order: DateOrder,
  date1904: boolean,
): { year: number; month: number; day: number } | null {
  const r = m.roles;
  if (r.date !== undefined) {
    const d = parseDateCell(row[r.date], order, date1904);
    if (d) return d;
  }
  if (r.year !== undefined && r.month !== undefined && r.day !== undefined) {
    const year = fullYear(toInteger(row[r.year]));
    const month = toInteger(row[r.month]);
    const day = toInteger(row[r.day]);
    if (year !== null && month !== null && day !== null) return { year, month, day };
  }
  return null;
}

function extractBlock(
  rows: readonly Cell[][],
  block: Block,
  context: { element: Element | null; fahrenheit: boolean },
  date1904: boolean,
  out: Collector,
): void {
  const m = block.map;
  const r = m.roles;
  const dataRows = rows.slice(block.headerRow + 1, block.endRow);
  const order = r.date !== undefined ? detectDateOrder(dataRows.map((row) => row?.[r.date!])) : 'dmy';
  if (r.date !== undefined && block.layout !== 'wide-days') out.dateOrder = order;

  const convert = (v: number | null, col: number) => {
    if (v === null || !(m.fahrenheit.has(col) || context.fahrenheit)) return v;
    out.fahrenheit = true;
    return fahrenheitToCelsius(v);
  };

  for (const row of dataRows) {
    if (!row || row.every(isBlank)) continue;
    let used = false;

    if (block.layout === 'wide-days') {
      let year = r.year !== undefined ? fullYear(toInteger(row[r.year])) : null;
      let month = r.month !== undefined ? toInteger(row[r.month]) : null;
      if (year === null || month === null) {
        const ym = parseYearMonthCell(row[r.date ?? r.month ?? -1], date1904);
        if (ym) ({ year, month } = ym);
      }
      const element = rowElement(row, m, context.element, out);
      if (year !== null && month !== null && month >= 1 && month <= 12 && element) {
        for (const [day, col] of m.days) {
          const raw = row[col];
          // Blank cells (including 30 February etc.) are simply missing days.
          if (isBlank(raw)) continue;
          out.observations.push({ year, month, day, [element]: convert(toNumber(raw), col) });
        }
        used = true;
      }
    } else if (block.layout === 'wide-months') {
      const year = fullYear(toInteger(row[r.year!]));
      const day = toInteger(row[r.day!]);
      const element = rowElement(row, m, context.element, out);
      if (year !== null && day !== null && day >= 1 && day <= 31 && element) {
        for (const [month, col] of m.months) {
          const raw = row[col];
          // Short months leave cells such as 30 February empty: skip those instead of reporting bad dates.
          if (isBlank(raw)) continue;
          out.observations.push({ year, month, day, [element]: convert(toNumber(raw), col) });
        }
        used = true;
      }
    } else if (block.layout === 'long') {
      const date = rowDate(row, m, order, date1904);
      if (date) {
        const obs: Observation = { ...date };
        if (r.tmax !== undefined) obs.tmax = convert(toNumber(row[r.tmax]), r.tmax);
        if (r.tmin !== undefined) obs.tmin = convert(toNumber(row[r.tmin]), r.tmin);
        out.observations.push(obs);
        used = true;
      }
    } else if (block.layout === 'long-element') {
      const date = rowDate(row, m, order, date1904);
      const element = rowElement(row, m, null, out);
      if (date && element) {
        out.observations.push({ ...date, [element]: convert(toNumber(row[r.value!]), r.value!) });
        used = true;
      }
    }

    if (used) {
      out.rowsUsed++;
      readStationColumns(row, m, out);
    } else {
      out.rowsSkipped++;
    }
  }
}

/** Last resort for files without recognisable column names: find a date column and two temperature columns. */
function extractByContent(sheet: Sheet, date1904: boolean, out: Collector): boolean {
  const rows = sheet.rows;
  const width = rows.reduce((w, r) => Math.max(w, r?.length ?? 0), 0);
  const columns = Array.from({ length: width }, (_, c) => rows.map((r) => r?.[c]));

  const nonBlank = (cells: Cell[]) => cells.filter((c) => !isBlank(c));
  const dateCols = columns
    .map((cells, c) => ({ c, cells: nonBlank(cells) }))
    .filter(({ cells }) => cells.length >= 10 && cells.filter(looksLikeDate).length >= 0.8 * cells.length);
  if (dateCols.length === 0) return false;
  const dateCol = dateCols[0].c;

  const temperatureCols: { c: number; mean: number }[] = [];
  columns.forEach((cells, c) => {
    if (c === dateCol) return;
    const filled = nonBlank(cells);
    const numbers = filled.map(toNumber).filter((n): n is number => n !== null);
    if (numbers.length < 10 || numbers.length < 0.8 * filled.length) return;
    if (numbers.filter((n) => n >= -50 && n <= 60).length < 0.9 * numbers.length) return;
    const allIntegers = numbers.every(Number.isInteger);
    if (allIntegers && numbers.every((n) => n >= 1 && n <= 31)) return; // day or month numbers
    temperatureCols.push({ c, mean: numbers.reduce((a, b) => a + b, 0) / numbers.length });
  });
  if (temperatureCols.length !== 2) {
    throw fileError(
      temperatureCols.length < 2
        ? 'The file has dates but the Tmax and Tmin columns could not be found. Name the columns Tmax and Tmin.'
        : 'The file has more than two number columns. Name the temperature columns Tmax and Tmin.',
    );
  }
  const [tmax, tmin] = temperatureCols[0].mean >= temperatureCols[1].mean ? temperatureCols : [temperatureCols[1], temperatureCols[0]];
  const order = detectDateOrder(columns[dateCol]);
  out.dateOrder = order;
  for (const row of rows) {
    const date = row ? parseDateCell(row[dateCol], order, date1904) : null;
    if (!date) {
      if (row && !row.every(isBlank)) out.rowsSkipped++;
      continue;
    }
    out.observations.push({ ...date, tmax: toNumber(row[tmax.c]), tmin: toNumber(row[tmin.c]) });
    out.rowsUsed++;
  }
  return true;
}

/** Turns the sheets of one uploaded file into observations. Throws AnalysisError('BAD_FILE') with one plain message. */
export function extractDataset(sheets: readonly Sheet[], fileName = '', date1904 = false): ParsedDataset {
  const out: Collector = {
    observations: [],
    stationNames: new Set(),
    station: { name: null, latitude: null, longitude: null, elevation: null },
    rowsUsed: 0,
    rowsSkipped: 0,
    fahrenheit: false,
    dateOrder: null,
    unknownElements: new Set(),
  };
  const sheetsUsed: string[] = [];
  let layout: Layout | null = null;
  let missingElement = false;

  for (const sheet of sheets) {
    const blocks = findBlocks(sheet.rows);
    if (blocks.length === 0) continue;
    metadataAbove(sheet.rows, blocks[0].headerRow, out.station);
    const before = out.observations.length;
    blocks.forEach((block, i) => {
      const title = titleTextAbove(sheet.rows, block.headerRow, i === 0 ? 0 : blocks[i - 1].headerRow + 1);
      const needsElement =
        (block.layout === 'wide-days' || block.layout === 'wide-months') && block.map.roles.element === undefined;
      const element = needsElement
        ? (elementFromTitle(title) ?? elementFromName(sheet.name) ?? elementFromName(fileName.replace(/\.[^.]+$/, '')))
        : null;
      if (needsElement && !element) missingElement = true;
      extractBlock(sheet.rows, block, { element, fahrenheit: mentionsFahrenheit(title) }, date1904, out);
    });
    if (out.observations.length > before) {
      sheetsUsed.push(sheet.name);
      layout ??= blocks[0].layout;
    }
  }

  if (out.observations.length === 0 && !missingElement && out.unknownElements.size === 0) {
    for (const sheet of sheets) {
      if (extractByContent(sheet, date1904, out)) {
        sheetsUsed.push(sheet.name);
        layout = 'auto-columns';
        break;
      }
    }
  }

  if (out.observations.length === 0) {
    if (missingElement) {
      throw fileError(
        'Could not tell whether the values are maximum or minimum temperatures. Add an element column (TMPMAX / TMPMIN) or name the sheet Tmax / Tmin.',
      );
    }
    if (out.unknownElements.size > 0) {
      const found = [...out.unknownElements].slice(0, 5).join(', ');
      throw fileError(`No TMPMAX or TMPMIN rows were found in the element column (found: ${found}).`);
    }
    throw fileError(
      'The temperature data could not be found in this file. It needs dates (or Year and Month) with Tmax and Tmin values. Download the template to see an example.',
    );
  }

  if (out.stationNames.size > 1) {
    const names = [...out.stationNames].slice(0, 3).join(', ');
    throw fileError(`The file has more than one station (${names}). Upload one station per file.`);
  }
  out.station.name ??= [...out.stationNames][0] ?? null;

  const hasValue = (e: Element) => out.observations.some((o) => o[e] !== undefined && o[e] !== null);
  if (!hasValue('tmax') && !hasValue('tmin')) throw fileError('The file has no temperature values.');
  if (!hasValue('tmax')) {
    throw fileError('Only minimum temperatures (Tmin) were found. The file also needs maximum temperatures (Tmax).');
  }
  if (!hasValue('tmin')) {
    throw fileError('Only maximum temperatures (Tmax) were found. The file also needs minimum temperatures (Tmin).');
  }

  return {
    layout: layout ?? 'auto-columns',
    station: out.station,
    observations: out.observations,
    details: {
      sheetsUsed,
      rowsUsed: out.rowsUsed,
      rowsSkipped: out.rowsSkipped,
      convertedFromFahrenheit: out.fahrenheit,
      dateOrder: out.dateOrder,
    },
  };
}
