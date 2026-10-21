/**
 * Excel workbook (ExcelJS, built in the browser): summary, 7-day maximum, annual minimum, heatmaps,
 * specification table (same colours as the page) and the calculation steps. Author: Abenezer Tilahun.
 */
import type ExcelJSType from 'exceljs';
import { BINDER_MATRIX, BINDER_MATRIX_HIGH, BINDER_MATRIX_LOW, type BinderTypeCode, type MonthlyCell } from '@pg/engine';
import { labTests } from './lab-tests';
import { BLUE_RAMP, RED_RAMP, rampColor } from './colors';
import { MONTH_NAMES, longDate, percent, shortDate } from './format';
import { AUTHOR, calculationSteps, fileBaseName, type ReportInput } from './report';
import type { ReportImages } from './report-charts';

type Workbook = ExcelJSType.Workbook;
type Worksheet = ExcelJSType.Worksheet;

const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const fill = (hex: string): ExcelJSType.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const BORDER: Partial<ExcelJSType.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
};

function headerRow(ws: Worksheet, values: string[], color: string) {
  const row = ws.addRow(values);
  row.eachCell((c) => {
    c.fill = fill(color);
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = BORDER;
  });
  row.height = 20;
  return row;
}

function boxRow(row: ExcelJSType.Row) {
  row.eachCell({ includeEmpty: true }, (c) => (c.border = BORDER));
}

function addImage(wb: Workbook, ws: Worksheet, dataUrl: string, col: number, row: number, width: number, height: number) {
  if (!dataUrl) return;
  const id = wb.addImage({ base64: dataUrl, extension: 'png' });
  ws.addImage(id, { tl: { col, row }, ext: { width, height } });
}

function title(ws: Worksheet, text: string, sub?: string) {
  ws.addRow([text]).font = { bold: true, size: 14 };
  if (sub) ws.addRow([sub]).font = { italic: true, color: { argb: 'FF52525B' } };
  ws.addRow([]);
}

function summarySheet(wb: Workbook, r: ReportInput) {
  const g = r.grade;
  const ws = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 34 }, { width: 46 }];
  title(ws, 'Superpave PG Binder Selection', `Prepared by ${AUTHOR} · AASHTO M320 / M323 · SHRP and LTPP models`);
  const final = ws.addRow(['Recommended binder', g.finalGrade.label]);
  final.getCell(2).font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  final.getCell(2).fill = fill('#0f172a');
  final.getCell(1).font = { bold: true };
  final.height = 30;
  const rows: [string, string | number][] = [
    ['Binder type', g.binderType.name],
    ['Rule of 90', `${g.finalGrade.high} + ${Math.abs(g.finalGrade.low)} = ${g.binderType.temperatureSum}`],
    ['Climate grade', g.climateGrade.label],
    ['Traffic adjustment', g.traffic.gradesAdded ? `+${g.traffic.gradesAdded} grade(s)` : 'none'],
    ['Reliability', `${g.reliabilityPercent}%`],
    ['Project', r.projectName],
    ['Station', r.stationName || '—'],
    ['Latitude (°)', r.latitude],
    ['Data file', r.fileName],
    ['Data period', r.period],
    ['Design ESAL (million)', r.esal],
    ['Design speed (km/h)', r.speed],
    ['Mean of 7-day averages (°C)', round(g.high.mean, 3)],
    ['σ of 7-day averages (°C)', round(g.high.sd, 3)],
    ['Design high air temperature (°C)', round(g.high.designAirTemp, 3)],
    ['T at 20 mm, SHRP model (°C)', round(g.high.pavementTemp, 3)],
    ['Mean of yearly minima (°C)', round(g.low.mean, 3)],
    ['σ of yearly minima (°C)', round(g.low.sd, 3)],
    ['T pav,low, LTPP model (°C)', round(g.low.pavementTemp, 3)],
    ['Years used (Tmax / Tmin)', `${g.high.yearsUsed} / ${g.low.yearsUsed}`],
    ['Engine version', g.engineVersion],
  ];
  for (const [k, v] of rows) {
    const row = ws.addRow([k, v]);
    row.getCell(1).font = { color: { argb: 'FF52525B' } };
    row.getCell(2).alignment = { horizontal: 'left' };
    boxRow(row);
  }
  if (r.link) ws.addRow(['Saved analysis', r.link]);
}

function round(v: number, d: number): number {
  return Math.round(v * 10 ** d) / 10 ** d;
}

function sevenDaySheet(wb: Workbook, r: ReportInput, image: string) {
  const ws = wb.addWorksheet('7-day maximum', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = [{ width: 8 }, { width: 11 }, { width: 11 }, ...Array.from({ length: 7 }, () => ({ width: 8 })), { width: 18 }];
  title(ws, 'Annual 7-Day Consecutive Maximum Temperature', 'Hottest year highlighted; grey rows are years not used (less than 75% of days recorded)');
  headerRow(ws, ['Year', 'Start date', 'End date', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', '7-day average (°C)'], '#e34948');
  const byYear = new Map(r.climate.high.years.map((y) => [y.year, y]));
  const excluded = new Map(r.climate.high.excluded.map((e) => [e.year, e]));
  for (const year of [...byYear.keys(), ...excluded.keys()].sort((a, b) => a - b)) {
    const y = byYear.get(year);
    if (!y) {
      const row = ws.addRow([year, `Not used: only ${percent(excluded.get(year)!.realFraction)} of days recorded`]);
      ws.mergeCells(row.number, 2, row.number, 11);
      row.eachCell({ includeEmpty: true }, (c) => {
        c.font = { italic: true, color: { argb: 'FF9CA3AF' } };
        c.fill = fill('#f4f4f5');
      });
      boxRow(row);
      continue;
    }
    const row = ws.addRow([year, shortDate(y.startDate), shortDate(y.endDate), ...y.days.map((d) => round(d, 1)), round(y.average, 2)]);
    row.getCell(11).font = { bold: true };
    for (let i = 4; i <= 11; i++) row.getCell(i).numFmt = i === 11 ? '0.00' : '0.0';
    if (year === r.grade.high.hottestYear) row.eachCell((c) => { c.fill = fill('#fdecec'); c.font = { bold: true }; });
    boxRow(row);
  }
  ws.addRow([]);
  for (const [k, v] of [
    ['Mean (°C)', r.grade.high.mean],
    ['Standard deviation σ (°C)', r.grade.high.sd],
    ['Design high air temperature, mean + 2.054σ (°C)', r.grade.high.designAirTemp],
  ] as [string, number][]) {
    const row = ws.addRow([k, '', '', '', '', '', '', '', '', '', round(v, 3)]);
    row.getCell(1).font = { bold: true };
  }
  addImage(wb, ws, image, 0, ws.rowCount + 1, 900, 390);
}

function minSheet(wb: Workbook, r: ReportInput, image: string) {
  const ws = wb.addWorksheet('Annual minimum', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = [{ width: 8 }, { width: 18 }, { width: 26 }];
  title(ws, 'Annual Minimum Temperature', 'Coldest year highlighted; grey rows are years not used (less than 75% of days recorded)');
  headerRow(ws, ['Year', 'Date', 'Minimum temperature (°C)'], '#2a78d6');
  const byYear = new Map(r.climate.low.years.map((y) => [y.year, y]));
  const excluded = new Map(r.climate.low.excluded.map((e) => [e.year, e]));
  for (const year of [...byYear.keys(), ...excluded.keys()].sort((a, b) => a - b)) {
    const y = byYear.get(year);
    if (!y) {
      const row = ws.addRow([year, `Not used: only ${percent(excluded.get(year)!.realFraction)} of days recorded`]);
      ws.mergeCells(row.number, 2, row.number, 3);
      row.eachCell({ includeEmpty: true }, (c) => {
        c.font = { italic: true, color: { argb: 'FF9CA3AF' } };
        c.fill = fill('#f4f4f5');
      });
      boxRow(row);
      continue;
    }
    const row = ws.addRow([year, longDate(y.date), round(y.value, 1)]);
    row.getCell(3).numFmt = '0.0';
    if (year === r.grade.low.coldestYear) row.eachCell((c) => { c.fill = fill('#e8f1fc'); c.font = { bold: true }; });
    boxRow(row);
  }
  ws.addRow([]);
  for (const [k, v] of [
    ['Mean (°C)', r.grade.low.mean],
    ['Standard deviation σ (°C)', r.grade.low.sd],
    ['Low air temperature used in design, the mean (°C)', r.grade.low.designAirTemp],
  ] as [string, number][]) {
    const row = ws.addRow([k, '', round(v, 3)]);
    row.getCell(1).font = { bold: true };
  }
  addImage(wb, ws, image, 4, 3, 900, 390);
}

function heatmapSheet(wb: Workbook, name: string, heading: string, cells: MonthlyCell[], ramp: readonly string[], colderIsDarker: boolean, notUsed: Set<number>) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 10 }, ...MONTH_NAMES.map(() => ({ width: 8 }))];
  title(ws, heading, 'Monthly mean of the recorded daily values (°C). Grey "–": fewer than half of the month\'s days recorded.');
  headerRow(ws, ['Year', ...MONTH_NAMES], '#374151');
  const years = [...new Set(cells.map((c) => c.year))].sort((a, b) => a - b);
  const grid = new Map(cells.map((c) => [`${c.year}-${c.month}`, c]));
  const means = cells.flatMap((c) => (c.mean === null ? [] : [c.mean]));
  const min = Math.min(...means);
  const max = Math.max(...means);
  for (const year of years) {
    const row = ws.addRow([notUsed.has(year) ? `${year} ✕` : year]);
    for (let m = 1; m <= 12; m++) {
      const cell = row.getCell(m + 1);
      const v = grid.get(`${year}-${m}`)?.mean ?? null;
      cell.alignment = { horizontal: 'center' };
      cell.border = BORDER;
      if (v === null) {
        cell.value = '–';
        cell.fill = fill('#eeeeef');
        cell.font = { color: { argb: 'FF9CA3AF' } };
        continue;
      }
      const t = max === min ? 0.5 : (v - min) / (max - min);
      const { fill: color, lightText } = rampColor(ramp, colderIsDarker ? 1 - t : t);
      cell.value = round(v, 1);
      cell.numFmt = '0.0';
      cell.fill = fill(color);
      cell.font = { bold: true, color: { argb: lightText ? 'FFFFFFFF' : 'FF111113' } };
    }
    if (notUsed.has(year)) row.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' } };
  }
  const all = ws.addRow(['All years', ...Array.from({ length: 12 }, (_, i) => {
    const v = cells.filter((c) => c.month === i + 1 && c.mean !== null).map((c) => c.mean as number);
    return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length, 1) : '—';
  })]);
  all.font = { bold: true };
  ws.addRow([]);
  ws.addRow(['✕ = year not used in the design.']).font = { italic: true, color: { argb: 'FF52525B' } };
}

function specSheet(wb: Workbook, r: ReportInput) {
  const spec = r.grade.spec;
  const L = spec.limits;
  const n = spec.columns.length;
  const ws = wb.addWorksheet('Specification', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 26 }, ...spec.columns.map(() => ({ width: 11 }))];
  ws.addRow([spec.title]).font = { bold: true, size: 13, name: 'Times New Roman' };
  ws.addRow([]);
  const S = { blue: '#2b8bd8', teal: '#17a589', red: '#ff6b6b', pink: '#fde4e4', lblue: '#dbeafa', orange: '#f39c12', purple: '#8e44ad', rtfo: '#e74c3c', pav: '#e67e22', yellow: '#fef3cd', green: '#d9f2e3', lav: '#dfe6fb', dtt: '#27ae60' };

  const style = (row: ExcelJSType.Row, from: number, to: number, bg: string, opts: { bold?: boolean; white?: boolean; center?: boolean } = {}) => {
    for (let i = from; i <= to; i++) {
      const c = row.getCell(i);
      c.fill = fill(bg);
      c.font = { bold: opts.bold, color: { argb: opts.white ? 'FFFFFFFF' : 'FF1F2937' } };
      c.alignment = { horizontal: opts.center ? 'center' : 'left', vertical: 'middle', wrapText: true };
      c.border = BORDER;
    }
  };
  const full = (left: string, text: string | number, bg: string, leftBg = '#ffffff', opts: { bold?: boolean; white?: boolean; center?: boolean } = {}) => {
    const row = ws.addRow([left, text]);
    ws.mergeCells(row.number, 2, row.number, n + 1);
    style(row, 1, 1, leftBg);
    style(row, 2, n + 1, bg, opts);
    return row;
  };
  const per = (left: string, values: number[], bg: string, leftBg = '#ffffff') => {
    const row = ws.addRow([left, ...values]);
    style(row, 1, 1, leftBg);
    spec.columns.forEach((c, i) => {
      style(row, i + 2, i + 2, c.selected ? S.orange : bg, { bold: c.selected, white: c.selected, center: true });
    });
    return row;
  };
  const section = (text: string, bg: string) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, n + 1);
    style(row, 1, n + 1, bg, { bold: true, white: true });
  };

  const top = ws.addRow(['Performance Grades']);
  ws.mergeCells(top.number, 1, top.number, 2);
  style(top, 1, n + 1, S.blue, { bold: true, white: true, center: true });
  full('Property', `PG ${spec.highGrade}`, S.teal, S.teal, { bold: true, white: true, center: true }).getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  full('Max. Design Temp. (°C)', spec.highGrade, S.red, S.pink, { bold: true, white: true, center: true });
  per('Min. Design Temp. (°C)', spec.columns.map((c) => c.lowGrade), S.lblue, S.lblue);
  section('Original Binder', S.purple);
  full(`≥${L.flashPointMinC} °C`, 'Flash Point', S.yellow);
  full(`≤${L.viscosityMaxPaS} Pa·s @ ${L.viscosityTestTempC} °C`, 'Rotational Viscosity', S.lblue);
  full(`≥${L.originalDsrMinKPa.toFixed(2)} kPa`, 'DSR G*/sin δ (Dynamic Shear Rheometer)', S.green);
  full('', spec.originalDsrTempC, S.red, '#ffffff', { bold: true, white: true, center: true });
  section(`(Rolling Thin Film Oven) RTFO, Mass Change ≤ ${L.rtfoMassChangeMaxPct.toFixed(2)}%`, S.rtfo);
  full(`≥${L.rtfoDsrMinKPa.toFixed(2)} kPa`, 'DSR G*/sin δ (Dynamic Shear Rheometer)', S.green);
  full('', spec.rtfoDsrTempC, S.red, '#ffffff', { bold: true, white: true, center: true });
  section('(Pressure Aging Vessel) PAV', S.pav);
  full(`${L.pavAgingHours} hours, ${L.pavPressureMPa.toFixed(2)} MPa`, spec.pavAgingTempLabel.replace(' (', '('), S.yellow, S.yellow, { bold: true, center: true });
  full(`≤${L.pavDsrMaxKPa} kPa`, 'DSR G*·sin δ (Dynamic Shear Rheometer) intermediate Temp = [(Max. + Min.)/2] + 4', S.lblue);
  per('', spec.columns.map((c) => c.pavDsrTempC), S.lblue);
  full(`S ≤ ${L.bbrStiffnessMaxMPa} MPa, m ≥ ${L.bbrMValueMin.toFixed(3)}`, 'BBR S (creep stiffness) & m-value (Bending Beam Rheometer)', S.lav);
  per('', spec.columns.map((c) => c.bbrTempC), S.lav);
  section('DTT (Direct Tension Tester)', S.dtt);
  per(`εf ≥ ${L.dttFailureStrainMinPct.toFixed(2)}%`, spec.columns.map((c) => c.dttTempC), '#ffffff');
  ws.addRow([]);
  const note = ws.addRow(['Note: The highlighted column (Orange background) indicates the test temperatures corresponding to the project selected PG grade. All values must meet the specified criteria for the binder to be certified for this performance grade according to AASHTO M320/M332 standards.']);
  ws.mergeCells(note.number, 1, note.number, n + 1);
  note.getCell(1).font = { bold: true, italic: true, name: 'Times New Roman' };
  note.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  note.height = 48;
}

function binderSheet(wb: Workbook, r: ReportInput) {
  const g = r.grade;
  const colors: Record<BinderTypeCode, string> = { 1: '#c6e3b3', 2: '#fff34d', 3: '#d39fd6' };
  const ws = wb.addWorksheet('Binder type', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 22 }, ...BINDER_MATRIX_HIGH.map(() => ({ width: 10 }))];
  title(ws, `Binder type for ${g.finalGrade.label}: ${g.binderType.name}`, 'Superpave PG grades for different crude oil blends (AASHTO M320). Selected grade: bold with a thick border.');
  headerRow(ws, ['Low / High', ...BINDER_MATRIX_HIGH.map(String)], '#374151');
  BINDER_MATRIX_LOW.forEach((low, i) => {
    const row = ws.addRow([low, ...BINDER_MATRIX_HIGH.map((h) => `${h}${low}`)]);
    row.getCell(1).font = { bold: true };
    BINDER_MATRIX_HIGH.forEach((h, j) => {
      const c = row.getCell(j + 2);
      const here = h === g.finalGrade.high && low === g.finalGrade.low;
      c.fill = fill(colors[BINDER_MATRIX[h][i]]);
      c.alignment = { horizontal: 'center' };
      c.font = { bold: here };
      c.border = here ? { top: { style: 'thick' }, bottom: { style: 'thick' }, left: { style: 'thick' }, right: { style: 'thick' } } : BORDER;
    });
  });
  ws.addRow([]);
  for (const [c, name] of [[1, 'Crude oil'], [2, 'High-quality crude oil'], [3, 'Modifier required']] as [BinderTypeCode, string][]) {
    ws.addRow(['', name]).getCell(1).fill = fill(colors[c]);
  }
  ws.addRow([]);
  ws.addRow(['Rule of 90', `${g.finalGrade.high} + ${Math.abs(g.finalGrade.low)} = ${g.binderType.temperatureSum} (${g.binderType.ruleOf90SaysModified ? 'likely modified' : 'typically unmodified'})`]).getCell(1).font = { bold: true };
  ws.addRow([]);
  ws.addRow([`Laboratory tests for ${g.finalGrade.label}`]).font = { bold: true, size: 12 };
  headerRow(ws, ['Test', 'Standard', 'Stage', 'Requirement'], '#374151');
  for (const t of labTests(g.spec)) {
    const row = ws.addRow([t.name, t.standard, t.stage, t.requirements.join('; ')]);
    ws.mergeCells(row.number, 4, row.number, 9);
    row.getCell(4).alignment = { wrapText: true };
    boxRow(row);
  }
}

function stepsSheet(wb: Workbook, r: ReportInput) {
  const ws = wb.addWorksheet('Calculation', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 16 }, { width: 130 }];
  title(ws, 'Calculation steps', 'Every step with the numbers filled in');
  for (const s of calculationSteps(r)) {
    ws.addRow([s.title]).font = { bold: true, size: 12 };
    for (const line of s.lines) {
      const row = ws.addRow([line.label ?? '', line.text]);
      row.getCell(1).font = { color: { argb: 'FF52525B' } };
      row.getCell(2).font = { bold: line.strong };
      row.getCell(2).alignment = { wrapText: true };
    }
    ws.addRow([]);
  }
}

/** Builds the workbook (also used by tests in Node). */
export async function buildWorkbook(ExcelJS: typeof ExcelJSType, r: ReportInput, images: ReportImages | null): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = AUTHOR;
  wb.lastModifiedBy = AUTHOR;
  wb.title = `PG binder selection – ${r.projectName}`;
  wb.subject = 'Superpave PG binder selection (AASHTO M320 / M323)';
  wb.created = new Date();
  summarySheet(wb, r);
  sevenDaySheet(wb, r, images?.sevenDay ?? '');
  minSheet(wb, r, images?.annualMin ?? '');
  heatmapSheet(wb, 'Heatmap Tmax', 'Daily maximum temperature (Tmax), monthly mean', r.climate.monthly.tmax, RED_RAMP, false, new Set(r.climate.high.excludedYears));
  heatmapSheet(wb, 'Heatmap Tmin', 'Daily minimum temperature (Tmin), monthly mean', r.climate.monthly.tmin, BLUE_RAMP, true, new Set(r.climate.low.excludedYears));
  specSheet(wb, r);
  binderSheet(wb, r);
  stepsSheet(wb, r);
  return wb;
}

export async function downloadExcel(r: ReportInput, images: ReportImages): Promise<void> {
  const mod = await import('exceljs');
  const ExcelJS = ((mod as { default?: typeof ExcelJSType }).default ?? mod) as typeof ExcelJSType;
  const wb = await buildWorkbook(ExcelJS, r, images);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBaseName(r)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
