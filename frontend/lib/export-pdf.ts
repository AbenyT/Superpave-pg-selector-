/**
 * PDF report (pdfmake, built in the browser): the same sections as the page, the specification table in the same
 * colours, and an appendix with the full calculation. File author: Abenezer Tilahun.
 */
import {
  BINDER_MATRIX, BINDER_MATRIX_HIGH, BINDER_MATRIX_LOW, BINDER_TYPES, DTT_FOOTNOTE, ESAL_CLASSES, GRADE_BUMP_TABLE, SPEC_TABLE_NOTE,
  type BinderTypeCode, type BumpCell, type SpeedClass,
} from '@pg/engine';
import { labTests } from './lab-tests';
import { longDate, num, percent, shortDate, signed, temp } from './format';
import { AUTHOR, calculationSteps, fileBaseName, type ReportInput } from './report';
import type { ReportImages } from './report-charts';

// pdfmake document nodes (the library ships no types for 0.3).
type Node = string | number | { [key: string]: unknown } | Node[];

const INK = '#111113';
const MUTED = '#52525b';
const LINE = '#d4d4d8';
const HI = '#e34948';
const LO = '#2a78d6';
const SPEC = {
  blue: '#2b8bd8', teal: '#17a589', red: '#ff6b6b', pink: '#fde4e4', lblue: '#dbeafa', orange: '#f39c12',
  purple: '#8e44ad', rtfo: '#e74c3c', pav: '#e67e22', yellow: '#fef3cd', green: '#d9f2e3', lav: '#dfe6fb', dtt: '#27ae60',
};

/** Small line icons for the specification table (same meaning as the icons in the reference table). */
const ICON_PATHS: Record<string, string> = {
  thermo: 'M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z',
  snow: 'M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9',
  flask: 'M9 2h6M10 2v6L4 20h16L14 8V2',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3-1-3 0-6 0-8z',
  drop: 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z',
  gauge: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 12l4-4',
  pot: 'M5 8h14v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM8 8V5h8v3',
  bars: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
};

function icon(name: string, color: string): Node {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="${ICON_PATHS[name]}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    width: 9,
  };
}

function withIcon(name: string, color: string, label: string, style: Record<string, unknown> = {}): Node {
  return { columns: [icon(name, color), { text: label, ...style }], columnGap: 4 };
}

function heading(index: string, title: string, color: string, subtitle?: string): Node {
  return [
    {
      table: { widths: [4, '*'], body: [[{ text: '', fillColor: color }, { text: [{ text: `${index}  `, color: MUTED }, title], style: 'h2', margin: [6, 2, 0, 2] }]] },
      layout: 'noBorders',
      margin: [0, 0, 0, subtitle ? 2 : 8],
    },
    subtitle ? { text: subtitle, style: 'muted', margin: [10, 0, 0, 8] } : '',
  ];
}

function statRow(items: [string, string, string?][]): Node {
  return {
    table: {
      widths: items.map(() => '*'),
      body: [
        items.map(([label, value, note]) => ({
          stack: [{ text: label.toUpperCase(), style: 'tiny' }, { text: value, bold: true, fontSize: 12, margin: [0, 2, 0, 0] }, note ? { text: note, style: 'tiny' } : ''],
          fillColor: '#f7f7f8',
          margin: [6, 5, 6, 5],
        })),
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 ? 0 : 2),
      vLineColor: () => '#ffffff',
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
    margin: [0, 6, 0, 8],
  };
}

const thin = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => LINE,
  vLineColor: () => LINE,
  paddingTop: () => 2,
  paddingBottom: () => 2,
};

function sevenDayTable(r: ReportInput): Node {
  const byYear = new Map(r.climate.high.years.map((y) => [y.year, y]));
  const excluded = new Map(r.climate.high.excluded.map((e) => [e.year, e]));
  const years = [...byYear.keys(), ...excluded.keys()].sort((a, b) => a - b);
  const head = ['Year', 'Start', 'End', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', '7-day avg (°C)'].map((t) => ({
    text: t, bold: true, color: '#ffffff', fillColor: HI, alignment: 'center', fontSize: 7.5,
  }));
  const body: Node[] = [head];
  for (const year of years) {
    const y = byYear.get(year);
    if (!y) {
      const e = excluded.get(year)!;
      body.push([
        { text: String(year), italics: true, color: '#9ca3af', fillColor: '#f4f4f5' },
        { text: `Not used: only ${percent(e.realFraction)} of days recorded`, colSpan: 10, italics: true, color: '#9ca3af', fillColor: '#f4f4f5' },
        '', '', '', '', '', '', '', '', '',
      ]);
      continue;
    }
    const top = year === r.grade.high.hottestYear;
    const fill = top ? '#fdecec' : undefined;
    body.push([
      { text: String(year), bold: top, fillColor: fill },
      { text: shortDate(y.startDate), fillColor: fill },
      { text: shortDate(y.endDate), fillColor: fill },
      ...y.days.map((d) => ({ text: num(d), alignment: 'right', fillColor: fill, bold: top })),
      { text: num(y.average, 2), alignment: 'right', bold: true, fillColor: fill },
    ]);
  }
  return { table: { headerRows: 1, widths: [26, 34, 34, '*', '*', '*', '*', '*', '*', '*', 52], body }, layout: thin, fontSize: 7.5 };
}

function minTable(r: ReportInput): Node {
  const byYear = new Map(r.climate.low.years.map((y) => [y.year, y]));
  const excluded = new Map(r.climate.low.excluded.map((e) => [e.year, e]));
  const years = [...byYear.keys(), ...excluded.keys()].sort((a, b) => a - b);
  const body: Node[] = [['Year', 'Date', 'Minimum temperature (°C)'].map((t) => ({ text: t, bold: true, color: '#ffffff', fillColor: LO, alignment: 'center' }))];
  for (const year of years) {
    const y = byYear.get(year);
    if (!y) {
      const e = excluded.get(year)!;
      body.push([
        { text: String(year), italics: true, color: '#9ca3af', fillColor: '#f4f4f5' },
        { text: `Not used: only ${percent(e.realFraction)} of days recorded`, colSpan: 2, italics: true, color: '#9ca3af', fillColor: '#f4f4f5' },
        '',
      ]);
      continue;
    }
    const top = year === r.grade.low.coldestYear;
    const fill = top ? '#e8f1fc' : undefined;
    body.push([
      { text: String(year), bold: top, fillColor: fill },
      { text: longDate(y.date), fillColor: fill },
      { text: num(y.value), alignment: 'right', bold: true, fillColor: fill },
    ]);
  }
  return { table: { headerRows: 1, widths: [50, '*', 140], body }, layout: thin, fontSize: 8.5 };
}

function modelBox(tag: string, title: string, sub: string, color: string, lines: { label?: string; text: string; strong?: boolean }[]): Node {
  return {
    table: {
      widths: [70, '*'],
      body: [
        [{ text: [{ text: ` ${tag} `, color: '#ffffff', background: color, bold: true }, { text: `  ${title}`, bold: true }, { text: `   ${sub}`, color: MUTED, fontSize: 8 }], colSpan: 2, margin: [4, 4, 4, 4], fillColor: '#f7f7f8' }, ''],
        ...lines.map((l) => [
          { text: (l.label ?? '').toUpperCase(), style: 'tiny', margin: [4, 2, 0, 2], fillColor: '#f7f7f8' },
          { text: l.text, bold: l.strong, margin: [0, 2, 4, 2], fillColor: '#f7f7f8' },
        ]),
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 3 : i === 1 ? 0.5 : 0),
      hLineColor: (i: number) => (i === 0 ? color : LINE),
      vLineWidth: () => 0,
    },
    fontSize: 9,
    margin: [0, 0, 0, 10],
  };
}

const SPEEDS: SpeedClass[] = ['standing', 'slow', 'standard'];
function cellText(cell: BumpCell): string {
  return cell === 'consider' ? 'consider +1' : cell === 0 ? '—' : `+${cell}`;
}

function trafficTable(r: ReportInput): Node {
  const t = r.grade.traffic;
  const body: Node[] = [
    [{ text: 'Design ESAL (million)', bold: true }, ...['Standing\n< 20 km/h', 'Slow\n20–70 km/h', 'Standard\n> 70 km/h'].map((s) => ({ text: s, bold: true, alignment: 'center' }))],
    ...ESAL_CLASSES.map((e) => [
      { text: e.label, bold: e.id === t.esalClass },
      ...SPEEDS.map((s) => {
        const here = e.id === t.esalClass && s === t.speedClass;
        return { text: cellText(GRADE_BUMP_TABLE[e.id][s]), alignment: 'center', bold: here, fillColor: here ? '#dcfce7' : undefined, color: here ? '#0f7a3a' : MUTED };
      }),
    ]),
  ];
  return { table: { headerRows: 1, widths: ['*', 70, 70, 70], body }, layout: thin, fontSize: 8.5 };
}

function specTable(r: ReportInput): Node {
  const spec = r.grade.spec;
  const n = spec.columns.length;
  const L = spec.limits;
  const filler = Array.from({ length: n - 1 }, () => '');
  const full = (content: Node, fill: string, opts: Record<string, unknown> = {}): Node[] => [
    { ...(typeof content === 'object' && !Array.isArray(content) ? content : { text: content }), colSpan: n, fillColor: fill, ...opts },
    ...filler,
  ];
  const per = (values: number[], fill: string): Node[] =>
    spec.columns.map((c, i) => ({ text: signed(values[i]), alignment: 'center', fillColor: c.selected ? SPEC.orange : fill, color: c.selected ? '#ffffff' : INK, bold: c.selected }));
  const head = (label: Node, fill: string): Node[] => [
    { ...(label as Record<string, unknown>), colSpan: n + 1, fillColor: fill, color: '#ffffff', bold: true },
    ...Array.from({ length: n }, () => ''),
  ];
  const left = (t: Node, fill = '#ffffff'): Node => (typeof t === 'object' && !Array.isArray(t) ? { ...t, fillColor: fill } : { text: t, fillColor: fill });

  const body: Node[][] = [
    [{ text: 'Performance Grades', colSpan: 2, bold: true, color: '#ffffff', fillColor: SPEC.blue, alignment: 'center' }, '', { text: '', colSpan: n - 1, fillColor: SPEC.blue }, ...Array.from({ length: n - 2 }, () => '')],
    [{ text: 'Property', bold: true, color: '#ffffff', fillColor: SPEC.teal }, ...full(`PG ${spec.highGrade}`, SPEC.teal, { bold: true, color: '#ffffff', alignment: 'center' })],
    [left(withIcon('thermo', '#c0392b', 'Max. Design Temp. (°C)', { bold: true, color: '#c0392b' }), SPEC.pink), ...full(String(spec.highGrade), SPEC.red, { bold: true, color: '#ffffff', alignment: 'center' })],
    [left(withIcon('snow', LO, 'Min. Design Temp. (°C)', { bold: true }), SPEC.lblue), ...per(spec.columns.map((c) => c.lowGrade), SPEC.lblue)],
    head(withIcon('flask', '#ffffff', 'Original Binder'), SPEC.purple),
    [left(`≥${L.flashPointMinC} °C`), ...full(withIcon('flame', '#e67e22', 'Flash Point'), SPEC.yellow)],
    [left(`≤${L.viscosityMaxPaS} Pa·s @ ${L.viscosityTestTempC} °C`), ...full(withIcon('drop', LO, 'Rotational Viscosity'), SPEC.lblue)],
    [left(`≥${L.originalDsrMinKPa.toFixed(2)} kPa`), ...full(withIcon('gauge', '#374151', 'DSR G*/sin δ (Dynamic Shear Rheometer)'), SPEC.green)],
    [left(''), ...full(String(spec.originalDsrTempC), SPEC.red, { bold: true, color: '#ffffff', alignment: 'center' })],
    head(withIcon('flame', '#ffffff', `(Rolling Thin Film Oven) RTFO, Mass Change ≤ ${L.rtfoMassChangeMaxPct.toFixed(2)}%`), SPEC.rtfo),
    [left(`≥${L.rtfoDsrMinKPa.toFixed(2)} kPa`), ...full(withIcon('gauge', '#374151', 'DSR G*/sin δ (Dynamic Shear Rheometer)'), SPEC.green)],
    [left(''), ...full(String(spec.rtfoDsrTempC), SPEC.red, { bold: true, color: '#ffffff', alignment: 'center' })],
    head(withIcon('pot', '#ffffff', '(Pressure Aging Vessel) PAV'), SPEC.pav),
    [left(`${L.pavAgingHours} hours, ${L.pavPressureMPa.toFixed(2)} MPa`, SPEC.yellow), ...full(spec.pavAgingTempLabel.replace(' (', '('), SPEC.yellow, { bold: true, alignment: 'center' })],
    [left(`≤${L.pavDsrMaxKPa} kPa`), ...full(withIcon('gauge', '#374151', 'DSR G*·sin δ (Dynamic Shear Rheometer) intermediate Temp = [(Max. + Min.)/2] + 4'), SPEC.lblue)],
    [left(''), ...per(spec.columns.map((c) => c.pavDsrTempC), SPEC.lblue)],
    [left(`S ≤ ${L.bbrStiffnessMaxMPa} MPa\nm ≥ ${L.bbrMValueMin.toFixed(3)}`), ...full(withIcon('bars', LO, 'BBR S (creep stiffness) & m-value (Bending Beam Rheometer)'), SPEC.lav)],
    [left(''), ...per(spec.columns.map((c) => c.bbrTempC), SPEC.lav)],
    head(withIcon('ruler', '#ffffff', 'DTT (Direct Tension Tester)'), SPEC.dtt),
    [left(`εf ≥ ${L.dttFailureStrainMinPct.toFixed(2)}%`), ...per(spec.columns.map((c) => c.dttTempC), '#ffffff')],
  ];
  return {
    stack: [
      { text: spec.title, bold: true, fontSize: 12, margin: [0, 0, 0, 6] },
      { table: { widths: ['24%', ...spec.columns.map(() => '*')], body }, layout: { ...thin, paddingTop: () => 4, paddingBottom: () => 4 }, fontSize: 8.5 },
      { text: [{ text: 'Note: ', bold: true }, { text: SPEC_TABLE_NOTE.replace('(orange background)', '(Orange background)'), bold: true, italics: true }], margin: [0, 6, 0, 0], fontSize: 9, alignment: 'justify' },
      { text: `DTT: ${DTT_FOOTNOTE.replace(/^Under/, 'under')}`, style: 'muted', margin: [0, 4, 0, 0] },
      spec.inM320 ? '' : { text: `${spec.label} is not listed in AASHTO M320 Table 1; the test temperatures follow the same rules.`, style: 'muted', italics: true },
    ],
  };
}

const BINDER_COLORS: Record<BinderTypeCode, string> = { 1: '#c6e3b3', 2: '#fff34d', 3: '#d39fd6' };

function binderPage(r: ReportInput): Node {
  const g = r.grade;
  const bt = g.binderType;
  const H = g.finalGrade.high;
  const L = g.finalGrade.low;
  const body: Node[] = [
    [{ text: 'Low / High', style: 'tiny', alignment: 'center' }, ...BINDER_MATRIX_HIGH.map((h) => ({ text: String(h), bold: true, alignment: 'center', color: h === H ? INK : MUTED }))],
    ...BINDER_MATRIX_LOW.map((low, i) => [
      { text: signed(low), bold: true, alignment: 'center', color: low === L ? INK : MUTED },
      ...BINDER_MATRIX_HIGH.map((h) => {
        const here = h === H && low === L;
        return {
          stack: [{ text: `${h}${low}`, bold: here }, here ? { text: 'YOUR GRADE', fontSize: 6, bold: true } : ''],
          fillColor: BINDER_COLORS[BINDER_MATRIX[h][i]],
          alignment: 'center',
          margin: [0, here ? 3 : 6, 0, here ? 2 : 6],
        };
      }),
    ]),
  ];
  return [
    heading('5', 'Binder Type and Laboratory Tests', INK, `Superpave PG grades for different crude oil blends (AASHTO M320): ${g.finalGrade.label} -> ${bt.name}`),
    {
      table: {
        widths: [28, '*', 130],
        body: [[
          { text: '', fillColor: BINDER_COLORS[bt.code] },
          { stack: [{ text: `BINDER TYPE FOR ${g.finalGrade.label}`, style: 'tiny' }, { text: bt.name, bold: true, fontSize: 14 }, { text: bt.description, style: 'muted' }], margin: [8, 4, 4, 4] },
          { stack: [{ text: 'RULE OF 90', style: 'tiny', alignment: 'right' }, { text: `${H} + ${Math.abs(L)} = ${bt.temperatureSum} ${bt.ruleOf90SaysModified ? '> 90' : '<= 90'}`, bold: true, alignment: 'right' }, { text: bt.ruleOf90SaysModified ? 'likely modified' : 'typically unmodified', style: 'muted', alignment: 'right' }], margin: [4, 4, 8, 4] },
        ]],
      },
      layout: thin,
      margin: [0, 0, 0, 10],
    },
    {
      table: { widths: [34, ...BINDER_MATRIX_HIGH.map(() => '*')], body },
      layout: { hLineWidth: () => 2, vLineWidth: () => 2, hLineColor: () => '#ffffff', vLineColor: () => '#ffffff' },
      fontSize: 9,
    },
    {
      columns: ([1, 2, 3] as BinderTypeCode[]).map((c) => ({
        columns: [{ canvas: [{ type: 'rect', x: 0, y: 1, w: 10, h: 10, r: 2, color: BINDER_COLORS[c] }], width: 14 }, { text: BINDER_TYPES[c].name, fontSize: 9 }],
      })),
      margin: [0, 6, 0, 16],
    },
    labPage(r),
  ];
}

function labPage(r: ReportInput): Node {
  const tests = labTests(r.grade.spec);
  const card = (t: (typeof tests)[number]): Node => ({
    table: {
      widths: [96, '*'],
      body: [[
        { svg: t.svg, width: 92, margin: [0, 4, 0, 4] },
        {
          stack: [
            { text: [{ text: t.name, bold: true, fontSize: 10.5 }, { text: `   ${t.standard}`, style: 'tiny' }] },
            { text: t.stage, fontSize: 8, color: t.color, bold: true },
            { text: t.purpose, fontSize: 8, color: '#374151', margin: [0, 3, 0, 3] },
            ...t.requirements.map((q) => ({ text: q, fontSize: 8.5, bold: true })),
          ],
          margin: [4, 3, 3, 3],
        },
      ]],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 3 : 0.5),
      hLineColor: (i: number) => (i === 0 ? t.color : LINE),
      vLineWidth: (i: number) => (i === 1 ? 0 : 0.5),
      vLineColor: () => LINE,
    },
    margin: [0, 0, 0, 8],
    unbreakable: true,
  });
  const rows: Node[] = [];
  for (let i = 0; i < tests.length; i += 2) {
    rows.push({ columns: [card(tests[i]), tests[i + 1] ? card(tests[i + 1]) : { text: '' }], columnGap: 8, unbreakable: true });
  }
  return [{ text: `Laboratory tests and equipment for ${r.grade.finalGrade.label}`, style: 'h2', margin: [0, 0, 0, 8], pageBreak: 'before' }, ...rows];
}

export function buildPdfDefinition(r: ReportInput, images: ReportImages, today = new Date()): Record<string, unknown> {
  const g = r.grade;
  const h = g.high;
  const l = g.low;
  const t = g.traffic;
  const lat = Math.abs(r.latitude);
  const steps = calculationSteps(r);
  const date = today.toISOString().slice(0, 10);
  const bump = t.gradesAdded === 0 ? 'no traffic adjustment' : `+${t.gradesAdded} grade${t.gradesAdded > 1 ? 's' : ''} for traffic`;

  const info: [string, string][] = [
    ['Project', r.projectName],
    ['Station', r.stationName || '—'],
    ['Latitude', `${num(r.latitude, 2)}°`],
    ['Data file', `${r.fileName} (${r.period})`],
    ['Design ESAL', `${num(r.esal, 2)} million`],
    ['Design speed', `${num(r.speed, 0)} km/h`],
    ['Reliability', `${g.reliabilityPercent}%`],
    ['Date', date],
  ];

  const content: Node[] = [
    { text: 'Superpave PG Binder Selection Report', style: 'h1' },
    { text: `Prepared by ${AUTHOR} · AASHTO M320 / M323 · SHRP and LTPP models`, style: 'muted', margin: [0, 2, 0, 12] },
    {
      table: {
        widths: [70, '*', 70, '*'],
        body: [0, 2, 4, 6].map((i) => [
          { text: info[i][0], style: 'label' }, { text: info[i][1] },
          { text: info[i + 1][0], style: 'label' }, { text: info[i + 1][1] },
        ]),
      },
      layout: thin,
      fontSize: 9,
      margin: [0, 0, 0, 12],
    },
    {
      columns: [
        {
          width: 210,
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'RECOMMENDED BINDER', fontSize: 8, color: '#cbd5e1', characterSpacing: 1 },
                { text: g.finalGrade.label, fontSize: 30, bold: true, color: '#ffffff', margin: [0, 2, 0, 2] },
                { text: `Climate ${g.climateGrade.label} → ${bump}`, fontSize: 9, color: '#e2e8f0' },
                { text: `Reliability ${g.reliabilityPercent}% · engine ${g.engineVersion}`, fontSize: 8, color: '#cbd5e1', margin: [0, 4, 0, 0] },
              ],
              fillColor: '#0f172a',
              margin: [10, 10, 10, 10],
            }]],
          },
          layout: 'noBorders',
        },
        {
          width: '*',
          table: {
            widths: ['*', '*'],
            body: [
              [kpi('T at 20 mm (SHRP)', temp(h.pavementTemp, 2), `→ PG ${g.climateGrade.high}`), kpi('T pav,low (LTPP)', temp(l.pavementTemp, 2), `→ ${signed(g.climateGrade.low)}`)],
              [kpi('Design high air temperature', temp(h.designAirTemp, 2), 'mean + 2.054 σ of 7-day averages'), kpi('Low air temperature used', temp(l.designAirTemp, 2), 'mean of yearly minima')],
              [kpi('Years used', `${h.yearsUsed} / ${l.yearsUsed}`, 'Tmax / Tmin'), kpi('Traffic', t.gradesAdded ? `+${t.gradesAdded} grade` : 'No bump', `${num(r.esal, 2)} M ESAL, ${num(r.speed, 0)} km/h`)],
            ],
          },
          layout: thin,
        },
      ],
      columnGap: 10,
      margin: [0, 0, 0, 14],
    },
    heading('1', 'Annual 7-Day Consecutive Maximum Temperature', HI, 'The hottest 7 consecutive days of each year (daily maximum temperature)'),
    { image: images.sevenDay, width: 523 },
    statRow([
      ['Mean of 7-day averages', temp(h.mean, 2), `${h.yearsUsed} years used`],
      ['Standard deviation σ', temp(h.sd, 2)],
      ['Design high air temperature', temp(h.designAirTemp, 2), 'mean + 2.054 × σ (98%)'],
      ['Hottest year', String(h.hottestYear)],
    ]),
    sevenDayTable(r),
    { text: 'Grey rows: years with less than 75% of days recorded; not used in the graph or the design.', style: 'muted', margin: [0, 4, 0, 0] },

    { text: '', pageBreak: 'before' },
    heading('2', 'Annual Minimum Temperature', LO, 'The lowest daily minimum temperature of each year'),
    { image: images.annualMin, width: 523 },
    statRow([
      ['Mean of yearly minima', temp(l.mean, 2), `${l.yearsUsed} years used`],
      ['Standard deviation σ', temp(l.sd, 2)],
      ['Low air temperature used in design', temp(l.designAirTemp, 2), 'the mean (T air in the LTPP model)'],
      ['Coldest year', String(l.coldestYear)],
    ]),
    minTable(r),
    { text: 'Grey rows: years with less than 75% of days recorded; not used in the graph or the design.', style: 'muted', margin: [0, 4, 0, 0] },

    { text: '', pageBreak: 'before' },
    heading('3', 'Monthly Temperature Heatmaps', '#374151', 'Mean of the recorded daily values for each month of each year (filled gaps are not shown)'),
    { image: images.heatTmax, width: 500, alignment: 'center', margin: [0, 0, 0, 10] },
    { image: images.heatTmin, width: 500, alignment: 'center' },

    { text: '', pageBreak: 'before' },
    heading('4', 'Final PG Grade and Specification', INK, `Reliability: ${g.reliabilityPercent}%  |  ${g.climateGrade.label} → ${g.finalGrade.label}`),
    modelBox('SHRP', 'High-temperature model', 'pavement temperature at 20 mm depth', HI, [
      { label: 'Formula', text: 'T(air) = mean(7-day) + z·σ(7-day);   T(20 mm) = (T(air) − 0.00618·Lat² + 0.2289·Lat + 42.2) × 0.9545 − 17.78' },
      { label: 'Inputs', text: `mean = ${num(h.mean, 2)} °C, σ = ${num(h.sd, 2)} °C, z = ${num(g.z, 3)} (98%), Lat = ${num(lat, 2)}° (${h.yearsUsed} years)` },
      { label: 'Air', text: `T(air) = ${num(h.mean, 2)} + ${num(g.z, 3)} × ${num(h.sd, 2)} = ${num(h.designAirTemp, 2)} °C` },
      { label: 'Pavement', text: `T(20 mm) = (${num(h.designAirTemp, 2)} − ${num(0.00618 * lat * lat, 3)} + ${num(0.2289 * lat, 3)} + 42.2) × 0.9545 − 17.78 = ${num(h.pavementTemp, 2)} °C` },
      { label: 'Grade', text: `${num(h.pavementTemp, 2)} °C → rounded up to PG ${g.climateGrade.high}${g.finalGrade.high !== g.climateGrade.high ? ` → traffic → PG ${g.finalGrade.high}` : ''}`, strong: true },
    ]),
    modelBox('LTPP', 'Low-temperature model', 'pavement temperature at the surface (H = 0 mm)', LO, [
      { label: 'Formula', text: 'T(pav) = −1.56 + 0.72·T(air) − 0.004·Lat² + 6.26·log10(H + 25) − z·√(4.4 + 0.52·σ²)' },
      { label: 'Inputs', text: `T(air) = ${num(l.meanAirTemp, 2)} °C (mean of yearly minima), σ = ${num(l.sd, 2)} °C, z = ${num(g.z, 3)}, Lat = ${num(lat, 2)}°, H = 0 (${l.yearsUsed} years)` },
      { label: 'Terms', text: `−1.56 + ${num(0.72 * l.meanAirTemp, 3)} − ${num(0.004 * lat * lat, 3)} + ${num(6.26 * Math.log10(25), 3)} = ${num(l.baseTemp, 3)}` },
      { label: 'Reliability', text: `${num(g.z, 3)} × √(4.4 + 0.52 × ${num(l.sd, 2)}²) = ${num(l.reliabilityTerm, 3)}` },
      { label: 'Pavement', text: `T(pav) = ${num(l.baseTemp, 3)} − ${num(l.reliabilityTerm, 3)} = ${num(l.pavementTemp, 2)} °C` },
      { label: 'Grade', text: `${num(l.pavementTemp, 2)} °C → rounded down to ${signed(g.climateGrade.low)}`, strong: true },
    ]),
    { text: 'Traffic adjustment (AASHTO M323 Table 1)', bold: true, margin: [0, 2, 0, 4] },
    trafficTable(r),
    { text: `Your project: ${num(r.esal, 2)} million ESAL at ${num(r.speed, 0)} km/h → ${bump}. One grade = 6 °C; the low grade does not change.`, style: 'muted', margin: [0, 3, 0, 12] },
    { stack: [specTable(r)], pageBreak: 'before', unbreakable: true },

    { stack: [binderPage(r)], pageBreak: 'before' },

    { text: '', pageBreak: 'before' },
    { text: 'Appendix: Calculation Steps', style: 'h1' },
    { text: 'Every step of the calculation with the numbers filled in.', style: 'muted', margin: [0, 2, 0, 10] },
    ...steps.map((s) => ({
      stack: [
        { text: s.title, bold: true, fontSize: 10.5, margin: [0, 6, 0, 3] },
        {
          table: {
            widths: [62, '*'],
            body: s.lines.map((line) => [{ text: line.label ?? '', style: 'label' }, { text: line.text, bold: line.strong }]),
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 1.5, paddingBottom: () => 1.5 },
          fontSize: 8.5,
        },
      ],
      unbreakable: s.lines.length < 12,
    })),
    r.link ? { text: `Saved analysis: ${r.link}`, style: 'muted', margin: [0, 12, 0, 0] } : '',
  ];

  return {
    pageSize: 'A4',
    pageMargins: [36, 50, 36, 44],
    info: {
      title: `PG binder report – ${r.projectName}`,
      author: AUTHOR,
      subject: 'Superpave PG binder selection (AASHTO M320 / M323)',
      creator: 'Superpave PG Binder Selector',
      keywords: `Superpave, PG ${g.finalGrade.label}, SHRP, LTPP, ${r.stationName}`,
    },
    header: () => ({
      columns: [
        { text: `Superpave PG Binder Selector · ${r.projectName}`, color: MUTED },
        { text: `Prepared by ${AUTHOR}`, alignment: 'right', color: MUTED },
      ],
      margin: [36, 20, 36, 0],
      fontSize: 7.5,
    }),
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `${date} · ${g.finalGrade.label} · engine ${g.engineVersion}`, color: MUTED },
        { text: `Page ${page} of ${pages}`, alignment: 'right', color: MUTED },
      ],
      margin: [36, 14, 36, 0],
      fontSize: 7.5,
    }),
    content: fontSafe(content),
    styles: {
      h1: { fontSize: 18, bold: true, color: INK },
      h2: { fontSize: 13, bold: true, color: INK },
      muted: { fontSize: 8, color: MUTED },
      tiny: { fontSize: 6.5, color: MUTED },
      label: { fontSize: 7.5, color: MUTED, bold: true },
    },
    defaultStyle: { fontSize: 9, color: INK, lineHeight: 1.15 },
  };
}

/** The built-in PDF font has no arrow glyph: write "->" instead of "→" (images and SVG icons are left alone). */
function fontSafe(node: Node): Node {
  if (typeof node === 'string') return node.replace(/\s?→\s?/g, ' -> ');
  if (Array.isArray(node)) return node.map(fontSafe);
  if (typeof node === 'object' && node !== null) {
    const out: { [key: string]: unknown } = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === 'svg' || k === 'image' || typeof v === 'function' ? v : fontSafe(v as Node);
    }
    return out;
  }
  return node;
}

function kpi(label: string, value: string, note: string): Node {
  return {
    stack: [{ text: label.toUpperCase(), style: 'tiny' }, { text: value, bold: true, fontSize: 12 }, { text: note, style: 'tiny' }],
    margin: [5, 3, 5, 3],
  };
}

/** Builds the PDF in the browser and downloads it. */
export async function downloadPdf(r: ReportInput, images: ReportImages): Promise<void> {
  const [{ default: pdfMake }, vfsModule] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  const vfs = (vfsModule as { default?: Record<string, string> }).default ?? (vfsModule as unknown as Record<string, string>);
  const maker = pdfMake as unknown as {
    addVirtualFileSystem: (v: Record<string, string>) => void;
    createPdf: (d: unknown) => { download: (name: string) => Promise<void> };
  };
  maker.addVirtualFileSystem(vfs);
  await maker.createPdf(buildPdfDefinition(r, images)).download(`${fileBaseName(r)}_report.pdf`);
}
