/** The four report pictures (7-day maximum, annual minimum, Tmax and Tmin heatmaps) for PNG, PDF and Excel. */
import type { ClimateView } from './api';
import { drawHeatmap, drawYearChart, PALETTE, type ChartBar } from './chart-canvas';
import { BLUE_RAMP, RED_RAMP } from './colors';
import { temp } from './format';
import type { ReportInput } from './report';

function yearsOf(used: number[], excluded: number[]): number[] {
  return [...used, ...excluded].sort((a, b) => a - b);
}

export function sevenDayCanvas(r: ReportInput): HTMLCanvasElement {
  const h = r.grade.high;
  const byYear = new Map(r.climate.high.years.map((y) => [y.year, y.average]));
  const bars: ChartBar[] = yearsOf([...byYear.keys()], r.climate.high.excludedYears).map((year) => ({
    year,
    value: byYear.get(year) ?? null,
    highlight: year === h.hottestYear,
  }));
  return drawYearChart({
    title: 'Annual 7-Day Consecutive Maximum Temperature',
    subtitle: `${r.projectName}${r.stationName ? ` · ${r.stationName}` : ''} · shaded band: mean ± 1σ`,
    bars,
    band: [h.mean - h.sd, h.mean + h.sd],
    lines: [
      { value: h.mean, label: `Mean: ${temp(h.mean, 2)}`, style: 'dashed' },
      { value: h.designAirTemp, label: `Design (98%): ${temp(h.designAirTemp, 2)}`, style: 'solid' },
    ],
    color: PALETTE.hi,
    strong: PALETTE.hiStrong,
    yLabel: '7-day average (°C)',
    decimals: 2,
  });
}

export function annualMinCanvas(r: ReportInput): HTMLCanvasElement {
  const l = r.grade.low;
  const byYear = new Map(r.climate.low.years.map((y) => [y.year, y.value]));
  const bars: ChartBar[] = yearsOf([...byYear.keys()], r.climate.low.excludedYears).map((year) => ({
    year,
    value: byYear.get(year) ?? null,
    highlight: year === l.coldestYear,
  }));
  return drawYearChart({
    title: 'Annual Minimum Temperature',
    subtitle: `${r.projectName}${r.stationName ? ` · ${r.stationName}` : ''} · shaded band: mean ± 1σ`,
    bars,
    band: [l.mean - l.sd, l.mean + l.sd],
    lines: [{ value: l.designAirTemp, label: `Design (mean): ${temp(l.designAirTemp, 2)}`, style: 'solid' }],
    color: PALETTE.lo,
    strong: PALETTE.loStrong,
    yLabel: 'Minimum temperature (°C)',
    decimals: 1,
  });
}

function monthOf(iso: string): number {
  return Number(iso.split('-')[1]);
}

export function heatmapCanvas(climate: ClimateView, element: 'tmax' | 'tmin'): HTMLCanvasElement {
  if (element === 'tmax') {
    return drawHeatmap({
      title: 'Daily maximum temperature (Tmax), monthly mean',
      cells: climate.monthly.tmax,
      ramp: RED_RAMP,
      colderIsDarker: false,
      marked: new Map(climate.high.years.map((y) => [y.year, monthOf(y.startDate)])),
      notUsedYears: new Set(climate.high.excludedYears),
      markLabel: "Month of the year's hottest 7-day window",
    });
  }
  return drawHeatmap({
    title: 'Daily minimum temperature (Tmin), monthly mean',
    cells: climate.monthly.tmin,
    ramp: BLUE_RAMP,
    colderIsDarker: true,
    marked: new Map(climate.low.years.map((y) => [y.year, monthOf(y.date)])),
    notUsedYears: new Set(climate.low.excludedYears),
    markLabel: "Month of the year's coldest night",
  });
}

export interface ReportImages {
  sevenDay: string;
  annualMin: string;
  heatTmax: string;
  heatTmin: string;
}

/** PNG data URLs of all four pictures. */
export function reportImages(r: ReportInput): ReportImages {
  return {
    sevenDay: sevenDayCanvas(r).toDataURL('image/png'),
    annualMin: annualMinCanvas(r).toDataURL('image/png'),
    heatTmax: heatmapCanvas(r.climate, 'tmax').toDataURL('image/png'),
    heatTmin: heatmapCanvas(r.climate, 'tmin').toDataURL('image/png'),
  };
}
