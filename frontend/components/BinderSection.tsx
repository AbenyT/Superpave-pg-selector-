'use client';
/** Section 5: binder type chart (crude oil / high-quality crude oil / modifier required) and laboratory tests. */
import { BINDER_MATRIX, BINDER_MATRIX_HIGH, BINDER_MATRIX_LOW, BINDER_TYPES, type BinderTypeCode, type GradeResult } from '@pg/engine';
import { labTests } from '@/lib/lab-tests';
import { signed } from '@/lib/format';
import { Layers } from './icons';
import { Section } from './ui';

/** Colours of the user's chart. */
export const BINDER_COLORS: Record<BinderTypeCode, string> = { 1: '#c6e3b3', 2: '#fff34d', 3: '#d39fd6' };

function Matrix({ grade }: { grade: GradeResult }) {
  const H = grade.finalGrade.high;
  const L = grade.finalGrade.low;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="num w-full min-w-[560px] border-separate border-spacing-[3px] text-center text-sm">
          <thead>
            <tr>
              <th className="w-20 text-xs font-medium text-subtle">Low (°C) \ High</th>
              {BINDER_MATRIX_HIGH.map((h) => (
                <th key={h} className={`pb-1 text-sm ${h === H ? 'font-bold text-ink' : 'font-medium text-muted'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BINDER_MATRIX_LOW.map((low, i) => (
              <tr key={low}>
                <th className={`text-sm ${low === L ? 'font-bold text-ink' : 'font-medium text-muted'}`}>{signed(low)}</th>
                {BINDER_MATRIX_HIGH.map((h) => {
                  const code = BINDER_MATRIX[h][i];
                  const here = h === H && low === L;
                  return (
                    <td key={h} title={BINDER_TYPES[code].name}
                      className={`relative h-11 rounded-md font-semibold text-[#1f2937] ${here ? 'outline-[3px] outline-offset-1 outline-ink' : ''}`}
                      style={{ background: BINDER_COLORS[code] }}>
                      {`${h}${low}`}
                      {here && <span className="absolute -top-2.5 right-1 rounded bg-ink px-1 text-[10px] font-bold text-surface">YOUR GRADE</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {([1, 2, 3] as BinderTypeCode[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-line-strong" style={{ background: BINDER_COLORS[c] }} />
            {BINDER_TYPES[c].name}
          </span>
        ))}
      </div>
      {!grade.binderType.fromChart && (
        <p className="mt-2 text-xs text-warn">
          {grade.finalGrade.label} is outside the chart; the type follows the general rule (very high or very low grades need a modifier).
        </p>
      )}
    </div>
  );
}

export function BinderSection({ grade }: { grade: GradeResult }) {
  const bt = grade.binderType;
  const tests = labTests(grade.spec);
  return (
    <Section id="binder" index="5" icon={<Layers />} title="Binder Type and Laboratory Tests"
      subtitle={<>Superpave PG grades for different crude oil blends (AASHTO M320) · {grade.finalGrade.label} → <b className="text-ink">{bt.name}</b></>}>
      <div className="max-w-5xl">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3" style={{ background: `${BINDER_COLORS[bt.code]}55` }}>
            <span className="h-8 w-8 shrink-0 rounded-md border border-line-strong" style={{ background: BINDER_COLORS[bt.code] }} />
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-subtle">Binder type for {grade.finalGrade.label}</div>
              <div className="text-lg font-bold">{bt.name}</div>
              <div className="text-sm text-muted">{bt.description}</div>
            </div>
            <div className="ml-auto text-right text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-subtle">Rule of 90</div>
              <div className="num font-semibold">
                {grade.finalGrade.high} + {Math.abs(grade.finalGrade.low)} = {bt.temperatureSum} {bt.ruleOf90SaysModified ? '> 90' : '≤ 90'}
              </div>
              <div className="text-xs text-muted">{bt.ruleOf90SaysModified ? 'likely modified' : 'typically unmodified'}</div>
            </div>
          </div>
          <Matrix grade={grade} />
        </div>

      <h3 className="mt-8 mb-3 text-base font-semibold">Laboratory tests and equipment for {grade.finalGrade.label}</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tests.map((t) => (
          <article key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex h-36 items-center justify-center bg-white p-3" style={{ borderTop: `4px solid ${t.color}` }}>
              <div className="h-full w-full max-w-[200px]" aria-hidden="true" dangerouslySetInnerHTML={{ __html: t.svg }} />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-semibold">{t.name}</h4>
                <span className="shrink-0 text-xs text-subtle">{t.standard}</span>
              </div>
              <div className="text-xs font-medium" style={{ color: t.color }}>{t.stage}</div>
              <p className="mt-2 text-sm text-muted">{t.purpose}</p>
              <ul className="num mt-auto space-y-1 pt-3 text-sm font-semibold">
                {t.requirements.map((r) => (
                  <li key={r} className="rounded-md bg-raised px-2 py-1">{r}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
