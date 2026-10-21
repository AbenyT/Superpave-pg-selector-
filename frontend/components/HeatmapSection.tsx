'use client';
import type { ClimateView } from '@/lib/api';
import { BLUE_RAMP, RED_RAMP } from '@/lib/colors';
import { Heatmap } from './Heatmap';
import { PngButton } from './ExportButtons';
import { Grid } from './icons';
import { Section } from './ui';

function monthOf(iso: string): number {
  return Number(iso.split('-')[1]);
}

export function HeatmapSection({ climate, onPng }: { climate: ClimateView; onPng: (element: 'tmax' | 'tmin') => void }) {
  const hottestWeek = new Map(climate.high.years.map((y) => [y.year, monthOf(y.startDate)]));
  const coldestDay = new Map(climate.low.years.map((y) => [y.year, monthOf(y.date)]));
  return (
    <Section id="heatmaps" index="3" icon={<Grid />} title="Monthly Temperature Heatmaps"
      subtitle="Mean of the recorded daily values for each month of each year (filled gaps are not shown)"
      actions={<div className="flex gap-2"><PngButton label="Tmax PNG" onClick={() => onPng('tmax')} /><PngButton label="Tmin PNG" onClick={() => onPng('tmin')} /></div>}>
      <div className="grid gap-8 xl:grid-cols-2">
        <Heatmap title="Daily maximum temperature (Tmax), monthly mean" cells={climate.monthly.tmax} ramp={RED_RAMP}
          colderIsDarker={false} marked={hottestWeek} notUsedYears={new Set(climate.high.excludedYears)}
          markLabel="Month of the year's hottest 7-day window" />
        <Heatmap title="Daily minimum temperature (Tmin), monthly mean" cells={climate.monthly.tmin} ramp={BLUE_RAMP}
          colderIsDarker marked={coldestDay} notUsedYears={new Set(climate.low.excludedYears)}
          markLabel="Month of the year's coldest night" />
      </div>
    </Section>
  );
}
