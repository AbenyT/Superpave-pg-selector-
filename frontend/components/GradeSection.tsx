'use client';
import type { GradeResult } from '@pg/engine';
import { gradeText, num, temp } from '@/lib/format';
import { DesignModels } from './DesignModels';
import { GradeLadder } from './GradeLadder';
import { Layers, Truck } from './icons';
import { SpecTable } from './SpecTable';
import { TrafficMatrix } from './TrafficMatrix';
import { Card, Section } from './ui';

const SPEED_WORD = { standing: 'standing', slow: 'slow', standard: 'standard' } as const;

/** The headline: final grade first, then the numbers behind it. */
export function ResultHero({
  grade,
  projectName,
  stationName,
  latitude,
  period,
}: {
  grade: GradeResult;
  projectName: string;
  stationName: string;
  latitude: number;
  period: string;
}) {
  const t = grade.traffic;
  const bump = t.gradesAdded === 0 ? 'no traffic adjustment' : `+${t.gradesAdded} grade${t.gradesAdded > 1 ? 's' : ''} for traffic`;
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
        <div className="bg-primary px-6 py-6 text-on-primary sm:px-8">
          <div className="text-xs font-medium uppercase tracking-[0.14em] opacity-70">Recommended binder</div>
          <div className="num mt-2 text-5xl font-extrabold tracking-tight sm:text-6xl">{gradeText(grade.finalGrade.label)}</div>
          <div className="mt-3 text-sm opacity-85">
            Climate {gradeText(grade.climateGrade.label)} → {bump}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-on-primary/15 px-2.5 py-1">Reliability {grade.reliabilityPercent}%</span>
            <span className="rounded-full bg-on-primary/15 px-2.5 py-1">{grade.binderType.name}</span>
            <span className="rounded-full bg-on-primary/15 px-2.5 py-1">AASHTO M320 / M323</span>
            <span className="rounded-full bg-on-primary/15 px-2.5 py-1">Engine {grade.engineVersion}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
          {[
            ['Project', projectName, stationName ? `Station: ${stationName}` : ''],
            ['Latitude', `${num(latitude, 2)}°`, `Data: ${period}`],
            ['Traffic', t.gradesAdded === 0 ? 'No bump' : `+${t.gradesAdded} grade${t.gradesAdded > 1 ? 's' : ''}`, `${SPEED_WORD[t.speedClass]} speed`],
            ['T at 20 mm (SHRP)', temp(grade.high.pavementTemp, 2), `→ PG ${grade.climateGrade.high}`],
            ['T_pav,low (LTPP)', temp(grade.low.pavementTemp, 2), `→ ${num(grade.climateGrade.low, 0)}`],
            ['Years used', `${grade.high.yearsUsed} / ${grade.low.yearsUsed}`, 'Tmax / Tmin'],
          ].map(([label, value, note]) => (
            <div key={label} className="bg-surface px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</div>
              <div className="num mt-1 truncate text-lg font-semibold" title={value}>{value}</div>
              {note && <div className="truncate text-xs text-muted">{note}</div>}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function GradeSection({
  grade,
  latitude,
  esal,
  speed,
  onConsider,
}: {
  grade: GradeResult;
  latitude: number;
  esal: number;
  speed: number;
  onConsider: (value: boolean) => void;
}) {
  return (
    <Section id="grade" index="4" icon={<Layers />} title="Final PG Grade and Specification"
      subtitle={<>Reliability: {grade.reliabilityPercent}% &nbsp;|&nbsp; {gradeText(grade.climateGrade.label)} → <b className="text-ink">{gradeText(grade.finalGrade.label)}</b></>}>
      <DesignModels grade={grade} latitude={latitude} />
      <div className="mt-6">
        <GradeLadder grade={grade} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Truck size={16} /> Traffic adjustment (AASHTO M323 Table 1)</h3>
          <TrafficMatrix traffic={grade.traffic} esal={esal} speed={speed} onConsider={onConsider} />
        </div>
        <div className="rounded-xl border border-line">
          <SpecTable spec={grade.spec} />
        </div>
      </div>
    </Section>
  );
}
