'use client';
/**
 * One bar per year (single series → no legend box; the section title names it).
 * Reference lines are labelled directly; a light band shows mean ± 1σ.
 * Left-out years keep their place on the axis, marked "n/a", so the time axis has no hidden gaps.
 */
import type { ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartAxis } from '@/lib/axis';
import { num } from '@/lib/format';

export interface YearBar {
  year: number;
  value: number | null;
  highlight: boolean;
  tooltip: ReactNode;
}

export interface RefLine {
  value: number;
  label: string;
  style: 'dashed' | 'solid';
}

export function YearBarChart({
  bars,
  lines,
  band,
  tone,
  decimals,
  yLabel,
}: {
  bars: YearBar[];
  lines: RefLine[];
  band?: [number, number];
  tone: 'hi' | 'lo';
  decimals: number;
  yLabel: string;
}) {
  const values = bars.flatMap((b) => (b.value === null ? [] : [b.value]));
  const { domain, ticks } = chartAxis([...values, ...lines.map((l) => l.value), ...(band ?? [])]);
  const color = tone === 'hi' ? 'var(--hi)' : 'var(--lo)';
  const strong = tone === 'hi' ? 'var(--hi-strong)' : 'var(--lo-strong)';
  const data = bars.map((b) => ({ ...b, name: String(b.year) }));
  const highlighted = bars.find((b) => b.highlight)?.value ?? undefined;

  return (
    <div className="h-[340px] w-full" role="img" aria-label={`${yLabel} by year`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 22, right: 176, bottom: 8, left: 4 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} strokeDasharray="0" />
          {band && (
            <ReferenceArea y1={band[0]} y2={band[1]} fill={color} fillOpacity={0.07} stroke="none" ifOverflow="extendDomain" />
          )}
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: 'var(--line-strong)' }}
            interval={0}
            height={46}
            tick={(props) => <YearTick {...props} bars={data} />}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            tickFormatter={(v: number) => num(v, ticks.some((t) => !Number.isInteger(t)) ? 1 : 0)}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 12 }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 8, fontSize: 12, style: { textAnchor: 'middle' } }}
          />
          <Tooltip
            cursor={{ fill: 'var(--raised)' }}
            content={({ active, payload }) => {
              const row = active && payload?.[0]?.payload;
              if (!row) return null;
              return (
                <div className="max-w-xs rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg">{(row as YearBar).tooltip}</div>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false}>
            {data.map((b) => (
              <Cell key={b.year} fill={b.highlight ? strong : color} stroke="var(--surface)" strokeWidth={1} />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => {
                // The library numbers only bars with a value, so match the highlighted bar by its value.
                const { x, y, width, value } = props as { x: number; y: number; width: number; value: number };
                if (highlighted === undefined || value !== highlighted) return null;
                return (
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">
                    {num(value, decimals)}
                  </text>
                );
              }}
            />
          </Bar>
          {lines.map((l) => (
            <ReferenceLine
              key={l.label}
              y={l.value}
              stroke={l.style === 'solid' ? 'var(--ink)' : 'var(--muted)'}
              strokeWidth={l.style === 'solid' ? 2 : 1.5}
              strokeDasharray={l.style === 'dashed' ? '6 4' : undefined}
              ifOverflow="extendDomain"
              label={{ value: l.label, position: 'right', fontSize: 12, fill: 'var(--ink)', fontWeight: 600 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function YearTick({ x, y, payload, bars }: { x?: number | string; y?: number | string; payload?: { value: string }; bars: (YearBar & { name: string })[] }) {
  const bar = bars.find((b) => b.name === payload?.value);
  const missing = bar?.value === null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={14} textAnchor="middle" fontSize={11} fill={missing ? 'var(--subtle)' : 'var(--muted)'}
        fontStyle={missing ? 'italic' : 'normal'} transform="rotate(-40)" style={{ textAnchor: 'end' }}>
        {payload?.value}
      </text>
      {missing && (
        <text dy={-4} textAnchor="middle" fontSize={10} fill="var(--subtle)">
          n/a
        </text>
      )}
    </g>
  );
}
