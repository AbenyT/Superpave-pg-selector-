/**
 * "Specification for Bitumen with Performance Grade PG XX-YY" in the classic Asphalt Institute spec-sheet style:
 * navy bars with yellow text, grey criteria column, white test-name rows and cream value cells that alternate
 * column by column. Every cell of the selected grade gets .selected-grade (gold, navy outline, fades in).
 * All colours are the --spec-* variables in globals.css (.spec-sheet), with a dark version for the dark theme.
 */
import type { ReactNode } from 'react';
import type { SpecTable as Spec } from '@pg/engine';
import { gradeText, signed } from '@/lib/format';

export function SpecTable({ spec }: { spec: Spec }) {
  const n = spec.columns.length;
  const L = spec.limits;

  /** One value per low-grade column: cream / cream-alt by column, gold for the selected grade. */
  const perColumn = (values: number[]) =>
    spec.columns.map((c, i) => (
      <td key={c.lowGrade} className={c.selected ? 'selected-grade' : i % 2 === 0 ? 'spec-val' : 'spec-val-alt'}>
        {signed(values[i])}
      </td>
    ));
  /** A full-width test temperature of the selected grade. */
  const selectedFull = (value: number) => <td colSpan={n} className="selected-grade">{value}</td>;
  /** A full-width test-name row: name in bold, the part in brackets in regular weight. */
  const test = (name: string, detail = '') => (
    <td colSpan={n} className="spec-test"><b>{name}</b>{detail && <> {detail}</>}</td>
  );
  const bar = (text: string) => (
    <tr><td colSpan={n + 1} className="spec-bar">{text}</td></tr>
  );
  const label = (content: ReactNode = '') => <td className="spec-label">{content}</td>;

  return (
    <div className="spec-sheet p-4 sm:p-5">
      <h3 className="spec-title mb-3 font-serif text-lg font-bold">{gradeText(spec.title)}</h3>
      <div className="overflow-x-auto">
        <table key={spec.label} className="num w-full min-w-[640px] font-sans text-[13px]">
          <colgroup>
            <col style={{ width: '25%' }} />
            {spec.columns.map((c) => <col key={c.lowGrade} style={{ width: `${75 / n}%` }} />)}
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} className="spec-bar spec-title-bar">Performance Grades</td>
              <td colSpan={n - 1} className="spec-bar" />
            </tr>
            <tr>
              <td className="spec-bar">Property</td>
              <td colSpan={n} className="spec-bar text-center">PG {spec.highGrade}</td>
            </tr>
            <tr>{label(<b>Max. Design Temp. (°C)</b>)}{selectedFull(spec.highGrade)}</tr>
            <tr>{label(<b>Min. Design Temp. (°C)</b>)}{perColumn(spec.columns.map((c) => c.lowGrade))}</tr>
            {bar('Original Binder')}
            <tr>{label(`≥${L.flashPointMinC} °C`)}{test('Flash Point')}</tr>
            <tr>{label(`≤${L.viscosityMaxPaS} Pa·s @ ${L.viscosityTestTempC} °C`)}{test('Rotational Viscosity')}</tr>
            <tr>{label(`≥${L.originalDsrMinKPa.toFixed(2)} kPa`)}{test('DSR G*/sin δ', '(Dynamic Shear Rheometer)')}</tr>
            <tr>{label()}{selectedFull(spec.originalDsrTempC)}</tr>
            {bar(`(Rolling Thin Film Oven) RTFO, Mass Change ≤ ${L.rtfoMassChangeMaxPct.toFixed(2)}%`)}
            <tr>{label(`≥${L.rtfoDsrMinKPa.toFixed(2)} kPa`)}{test('DSR G*/sin δ', '(Dynamic Shear Rheometer)')}</tr>
            <tr>{label()}{selectedFull(spec.rtfoDsrTempC)}</tr>
            {bar('(Pressure Aging Vessel) PAV')}
            <tr>
              {label(`${L.pavAgingHours} hours, ${L.pavPressureMPa.toFixed(2)} MPa`)}
              <td colSpan={n} className="spec-val font-bold">{spec.pavAgingTempLabel.replace(' (', '(')}</td>
            </tr>
            <tr>
              {label(`≤${L.pavDsrMaxKPa} kPa`)}
              {test('DSR G*·sin δ', '(Dynamic Shear Rheometer) intermediate Temp = [(Max. + Min.)/2] + 4')}
            </tr>
            <tr>{label()}{perColumn(spec.columns.map((c) => c.pavDsrTempC))}</tr>
            <tr>
              {label(<>S ≤ {L.bbrStiffnessMaxMPa} MPa<br />m ≥ {L.bbrMValueMin.toFixed(3)}</>)}
              {test('BBR S (creep stiffness) & m-value', '(Bending Beam Rheometer)')}
            </tr>
            <tr>{label()}{perColumn(spec.columns.map((c) => c.bbrTempC))}</tr>
            {bar('DTT (Direct Tension Tester)')}
            <tr>{label(<>ε<sub>f</sub> ≥ {L.dttFailureStrainMinPct.toFixed(2)}%</>)}{perColumn(spec.columns.map((c) => c.dttTempC))}</tr>
          </tbody>
        </table>
      </div>
      <p className="spec-note mt-3">
        <b>Note:</b> The <span className="spec-swatch" aria-hidden="true" /> highlighted cells (gold background with navy outline)
        indicate the test temperatures corresponding to the project-selected PG grade. All values must meet the specified
        criteria for the binder to be certified for this performance grade according to AASHTO M320/M332.
      </p>
      {!spec.inM320 && (
        <p className="spec-title mt-2 font-serif text-[13px] italic">
          {gradeText(spec.label)} is not listed in AASHTO M320 Table 1; the test temperatures above follow the same rules.
        </p>
      )}
    </div>
  );
}
