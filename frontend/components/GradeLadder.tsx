/**
 * Where the design pavement temperatures fall on the PG classes.
 * High: class g covers (g − 6, g]; the marker is T at 20 mm; an arrow shows the traffic bump.
 * Low: class g covers [g, g + 6); anything warmer than −10 is −10.
 */
import { HIGH_GRADES, LOW_GRADES, type GradeResult } from '@pg/engine';
import { num, signed } from '@/lib/format';

const W = 640;
const PAD = 18;

function Scale({
  min,
  max,
  classes,
  bandOf,
  value,
  valueLabel,
  climate,
  final,
  tone,
  title,
}: {
  min: number;
  max: number;
  classes: readonly number[];
  bandOf: (g: number) => [number, number];
  value: number;
  valueLabel: string;
  climate: number;
  final: number;
  tone: 'hi' | 'lo';
  title: string;
}) {
  const x = (t: number) => PAD + ((Math.max(min, Math.min(max, t)) - min) / (max - min)) * (W - 2 * PAD);
  const color = tone === 'hi' ? 'var(--hi)' : 'var(--lo)';
  const [c0, c1] = bandOf(climate);
  const [f0, f1] = bandOf(final);
  const vx = x(value);
  return (
    <figure className="w-full">
      <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide text-subtle">{title}</figcaption>
      <svg viewBox={`0 0 ${W} 104`} className="w-full" role="img" aria-label={`${title}: ${valueLabel}`}>
        <rect x={PAD} y={46} width={W - 2 * PAD} height={18} rx={4} fill="var(--raised)" stroke="var(--line)" />
        {final !== climate && (
          <rect x={x(f0)} y={46} width={x(f1) - x(f0)} height={18} fill={color} fillOpacity={0.9} rx={3} />
        )}
        <rect x={x(c0)} y={46} width={x(c1) - x(c0)} height={18} fill={color} fillOpacity={final !== climate ? 0.35 : 0.9} rx={3} />
        {classes.map((g) => {
          const [a, b] = bandOf(g);
          const mid = (x(a) + x(b)) / 2;
          const strong = g === final || g === climate;
          return (
            <g key={g}>
              <line x1={x(tone === 'hi' ? b : a)} x2={x(tone === 'hi' ? b : a)} y1={42} y2={68} stroke="var(--line-strong)" />
              <text x={mid} y={82} textAnchor="middle" fontSize={11} fontWeight={strong ? 700 : 400}
                fill={strong ? 'var(--ink)' : 'var(--subtle)'}>
                {tone === 'hi' ? `PG ${g}` : signed(g)}
              </text>
            </g>
          );
        })}
        {final !== climate && (
          <g>
            <path d={`M ${(x(c0) + x(c1)) / 2} 98 Q ${(x(c1) + x(f0)) / 2} 104 ${(x(f0) + x(f1)) / 2} 98`} fill="none" stroke="var(--ink)"
              strokeWidth={1.5} markerEnd="url(#arrow)" />
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
              </marker>
            </defs>
          </g>
        )}
        <line x1={vx} x2={vx} y1={30} y2={66} stroke="var(--ink)" strokeWidth={2} />
        <circle cx={vx} cy={30} r={4.5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
        <text x={Math.min(Math.max(vx, 90), W - 90)} y={20} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">
          {valueLabel}
        </text>
      </svg>
    </figure>
  );
}

export function GradeLadder({ grade }: { grade: GradeResult }) {
  const highMax = Math.max(94, grade.high.pavementTemp + 3);
  const lowMax = Math.max(-4, Math.min(16, grade.low.pavementTemp + 4));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Scale title="High temperature grade (SHRP model, 20 mm)" min={40} max={highMax} classes={HIGH_GRADES} bandOf={(g) => [g - 6, g]}
        value={grade.high.pavementTemp} valueLabel={`T at 20 mm = ${num(grade.high.pavementTemp, 2)} °C`}
        climate={grade.climateGrade.high} final={grade.finalGrade.high} tone="hi" />
      <Scale title="Low temperature grade (LTPP model, surface)" min={-52} max={lowMax} classes={[...LOW_GRADES].reverse()}
        bandOf={(g) => (g === -10 ? [-10, lowMax] : [g, g + 6])}
        value={grade.low.pavementTemp} valueLabel={`T_pav,low = ${num(grade.low.pavementTemp, 2)} °C`}
        climate={grade.climateGrade.low} final={grade.finalGrade.low} tone="lo" />
    </div>
  );
}
