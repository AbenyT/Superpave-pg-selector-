/**
 * Print-quality pictures of the graphs and heatmaps (fixed light colours, 2× resolution), used for the PNG
 * downloads and inside the PDF and Excel files. Same content and colours as the charts on the page.
 */
import type { MonthlyCell } from '@pg/engine';
import { chartAxis } from './axis';
import { rampColor } from './colors';
import { MONTH_NAMES, num } from './format';

const INK = '#111113';
const MUTED = '#52525b';
const SUBTLE = '#8a8a93';
const GRID = '#e7e7ea';
const FONT = 'Inter, "Segoe UI", Arial, sans-serif';
const SCALE = 2;

export const PALETTE = {
  hi: '#e34948',
  hiStrong: '#9b2424',
  lo: '#2a78d6',
  loStrong: '#104281',
};

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width * SCALE;
  c.height = height * SCALE;
  const ctx = c.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return [c, ctx];
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, opts: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; italic?: boolean } = {}) {
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 400} ${opts.size ?? 13}px ${FONT}`;
  ctx.fillStyle = opts.color ?? INK;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'alphabetic';
  ctx.fillText(s, x, y);
}

export interface ChartBar {
  year: number;
  value: number | null;
  highlight: boolean;
}

export interface ChartLine {
  value: number;
  label: string;
  style: 'dashed' | 'solid';
}

export function drawYearChart(o: {
  title: string;
  subtitle?: string;
  bars: ChartBar[];
  lines: ChartLine[];
  band?: [number, number];
  color: string;
  strong: string;
  yLabel: string;
  decimals: number;
}): HTMLCanvasElement {
  const W = 1200;
  const H = 520;
  const [c, ctx] = canvas(W, H);
  const left = 72;
  const right = 230;
  const top = 74;
  const bottom = 78;
  const pw = W - left - right;
  const ph = H - top - bottom;

  text(ctx, o.title, 24, 34, { size: 19, weight: 700 });
  if (o.subtitle) text(ctx, o.subtitle, 24, 56, { size: 13, color: MUTED });

  const values = o.bars.flatMap((b) => (b.value === null ? [] : [b.value]));
  const { domain, ticks } = chartAxis([...values, ...o.lines.map((l) => l.value), ...(o.band ?? [])]);
  const y = (v: number) => top + ph - ((v - domain[0]) / (domain[1] - domain[0])) * ph;
  const base = y(Math.max(domain[0], Math.min(domain[1], 0)));

  // grid and y-axis labels
  const decimalsTicks = ticks.some((t) => !Number.isInteger(t)) ? 1 : 0;
  ctx.lineWidth = 1;
  for (const t of ticks) {
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(left, y(t));
    ctx.lineTo(left + pw, y(t));
    ctx.stroke();
    text(ctx, num(t, decimalsTicks), left - 10, y(t), { size: 12, color: MUTED, align: 'right', baseline: 'middle' });
  }
  ctx.save();
  ctx.translate(20, top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  text(ctx, o.yLabel, 0, 0, { size: 12, color: MUTED, align: 'center', baseline: 'middle' });
  ctx.restore();

  // mean ± 1σ band
  if (o.band) {
    ctx.fillStyle = o.color;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(left, y(o.band[1]), pw, y(o.band[0]) - y(o.band[1]));
    ctx.globalAlpha = 1;
  }

  // bars
  const slot = pw / o.bars.length;
  const bw = Math.min(34, slot * 0.72);
  o.bars.forEach((b, i) => {
    const cx = left + slot * i + slot / 2;
    if (b.value !== null) {
      const yv = y(b.value);
      const yTop = Math.min(yv, base);
      const h = Math.abs(base - yv);
      ctx.fillStyle = b.highlight ? o.strong : o.color;
      ctx.beginPath();
      const r = Math.min(4, h / 2, bw / 2);
      if (yv <= base) ctx.roundRect(cx - bw / 2, yTop, bw, h, [r, r, 0, 0]);
      else ctx.roundRect(cx - bw / 2, yTop, bw, h, [0, 0, r, r]);
      ctx.fill();
      if (b.highlight) text(ctx, num(b.value, o.decimals), cx, yv - 7, { size: 12, weight: 700, align: 'center' });
    } else {
      text(ctx, 'n/a', cx, top + ph - 6, { size: 10, color: SUBTLE, align: 'center', italic: true });
    }
    ctx.save();
    ctx.translate(cx + 4, top + ph + 14);
    ctx.rotate(-Math.PI / 4.5);
    text(ctx, String(b.year), 0, 0, { size: 11, color: b.value === null ? SUBTLE : MUTED, align: 'right', baseline: 'middle', italic: b.value === null });
    ctx.restore();
  });

  // x axis
  ctx.strokeStyle = '#cfcfd6';
  ctx.beginPath();
  ctx.moveTo(left, top + ph);
  ctx.lineTo(left + pw, top + ph);
  ctx.stroke();

  // reference lines, labelled in the right margin
  for (const l of o.lines) {
    const yl = y(l.value);
    ctx.strokeStyle = l.style === 'solid' ? INK : MUTED;
    ctx.lineWidth = l.style === 'solid' ? 2 : 1.5;
    ctx.setLineDash(l.style === 'dashed' ? [7, 5] : []);
    ctx.beginPath();
    ctx.moveTo(left, yl);
    ctx.lineTo(left + pw, yl);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, l.label, left + pw + 10, yl, { size: 13, weight: 600, baseline: 'middle' });
  }
  return c;
}

export function drawHeatmap(o: {
  title: string;
  cells: MonthlyCell[];
  ramp: readonly string[];
  colderIsDarker: boolean;
  marked: Map<number, number>;
  notUsedYears: Set<number>;
  markLabel: string;
}): HTMLCanvasElement {
  const years = [...new Set(o.cells.map((c) => c.year))].sort((a, b) => a - b);
  const grid = new Map(o.cells.map((c) => [`${c.year}-${c.month}`, c]));
  const means = o.cells.flatMap((c) => (c.mean === null ? [] : [c.mean]));
  const min = Math.min(...means);
  const max = Math.max(...means);
  const labelW = 70;
  const cw = 72;
  const ch = 26;
  const gap = 2;
  const top = 92;
  const W = labelW + 12 * (cw + gap) + 30;
  const H = top + (years.length + 1) * (ch + gap) + 64;
  const [c, ctx] = canvas(W, H);

  text(ctx, o.title, 20, 32, { size: 18, weight: 700 });
  text(ctx, 'Monthly mean of the recorded daily values', 20, 54, { size: 12, color: MUTED });
  // legend
  const legend = o.colderIsDarker ? [...o.ramp].reverse() : [...o.ramp];
  const lx = W - 260;
  const g = ctx.createLinearGradient(lx + 40, 0, lx + 190, 0);
  legend.forEach((col, i) => g.addColorStop(i / (legend.length - 1), col));
  text(ctx, num(min), lx + 34, 40, { size: 12, color: MUTED, align: 'right', baseline: 'middle' });
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(lx + 40, 34, 150, 12, 6);
  ctx.fill();
  text(ctx, `${num(max)} °C`, lx + 196, 40, { size: 12, color: MUTED, baseline: 'middle' });

  MONTH_NAMES.forEach((m, i) => text(ctx, m, labelW + i * (cw + gap) + cw / 2, top - 10, { size: 12, color: MUTED, align: 'center', weight: 600 }));

  years.forEach((year, r) => {
    const yy = top + r * (ch + gap);
    const out = o.notUsedYears.has(year);
    text(ctx, out ? `${year} ✕` : String(year), labelW - 10, yy + ch / 2, { size: 12, color: out ? SUBTLE : MUTED, align: 'right', baseline: 'middle', italic: out, weight: 600 });
    for (let m = 1; m <= 12; m++) {
      const x = labelW + (m - 1) * (cw + gap);
      const cell = grid.get(`${year}-${m}`);
      ctx.beginPath();
      ctx.roundRect(x, yy, cw, ch, 3);
      if (!cell || cell.mean === null) {
        ctx.fillStyle = '#f4f4f5';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 1;
        for (let k = -ch; k < cw; k += 7) {
          ctx.beginPath();
          ctx.moveTo(x + k, yy + ch);
          ctx.lineTo(x + k + ch, yy);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      const t = max === min ? 0.5 : (cell.mean - min) / (max - min);
      const { fill, lightText } = rampColor(o.ramp, o.colderIsDarker ? 1 - t : t);
      ctx.fillStyle = fill;
      ctx.fill();
      if (o.marked.get(year) === m) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      text(ctx, num(cell.mean), x + cw / 2, yy + ch / 2 + 1, { size: 12, weight: 600, color: lightText ? '#ffffff' : INK, align: 'center', baseline: 'middle' });
    }
  });

  const yAll = top + years.length * (ch + gap) + 6;
  text(ctx, 'All yrs', labelW - 10, yAll + ch / 2, { size: 12, weight: 700, color: MUTED, align: 'right', baseline: 'middle' });
  for (let m = 1; m <= 12; m++) {
    const v = o.cells.filter((c) => c.month === m && c.mean !== null).map((c) => c.mean as number);
    const s = v.length ? num(v.reduce((a, b) => a + b, 0) / v.length) : '—';
    text(ctx, s, labelW + (m - 1) * (cw + gap) + cw / 2, yAll + ch / 2, { size: 12, weight: 700, color: MUTED, align: 'center', baseline: 'middle' });
  }
  text(ctx, `Outlined: ${o.markLabel.toLowerCase()}. Hatched: fewer than half of the month's days recorded. ✕: year not used in the design.`,
    20, H - 18, { size: 11, color: MUTED });
  return c;
}

export function downloadCanvas(c: HTMLCanvasElement, fileName: string): void {
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = fileName;
  a.click();
}
