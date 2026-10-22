/**
 * "Specification for Bitumen with Performance Grade PG XX-YY", laid out like the reference table:
 * blue header, purple Original Binder, red RTFO, orange PAV, green DTT. Every cell of the selected grade
 * uses one soft highlight (.selected-grade in globals.css) that fades in.
 * It is a document, so it keeps its own light colours in dark mode too.
 */
import type { SpecTable as Spec } from '@pg/engine';
import { gradeText, signed } from '@/lib/format';

const C = {
  blue: '#2b8bd8', teal: '#17a589', pink: '#fde4e4', lblue: '#dbeafa',
  purple: '#8e44ad', rtfo: '#e74c3c', pav: '#e67e22', yellow: '#fef3cd', green: '#d9f2e3', lav: '#dfe6fb',
  dtt: '#27ae60', white: '#ffffff',
};

export function SpecTable({ spec }: { spec: Spec }) {
  const n = spec.columns.length;
  const L = spec.limits;
  const td = 'border border-[#c9ced6] px-2.5 py-2';

  const perColumn = (values: number[], bg: string) =>
    spec.columns.map((c, i) => (
      <td key={c.lowGrade} className={`${td} text-center ${c.selected ? 'selected-grade' : ''}`}
        style={c.selected ? undefined : { background: bg, color: '#1f2937' }}>
        {signed(values[i])}
      </td>
    ));
  const full = (content: React.ReactNode, bg: string, opts: { bold?: boolean; white?: boolean; center?: boolean } = {}) => (
    <td colSpan={n} className={`${td} ${opts.center ? 'text-center' : ''}`}
      style={{ background: bg, color: opts.white ? '#fff' : '#1f2937', fontWeight: opts.bold ? 700 : 400 }}>
      {content}
    </td>
  );
  /** A full-width cell holding a test temperature of the selected grade. */
  const selectedFull = (value: number) => (
    <td colSpan={n} className={`${td} selected-grade text-center`}>{value}</td>
  );
  const head = (text: string, bg: string) => (
    <tr><td colSpan={n + 1} className={td} style={{ background: bg, color: '#fff', fontWeight: 700 }}>{text}</td></tr>
  );
  const left = (text: React.ReactNode, bg = C.white) => (
    <td className={td} style={{ background: bg, color: '#1f2937' }}>{text}</td>
  );

  return (
    <div className="rounded-xl bg-white p-4 text-[#1f2937] sm:p-5">
      <h3 className="mb-3 font-serif text-lg font-bold">{gradeText(spec.title)}</h3>
      <div className="overflow-x-auto">
        <table key={spec.label} className="num w-full min-w-[640px] border-collapse font-sans text-[13px]">
          <colgroup>
            <col style={{ width: '25%' }} />
            {spec.columns.map((c) => <col key={c.lowGrade} style={{ width: `${75 / n}%` }} />)}
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} className={`${td} text-center font-bold text-white`} style={{ background: C.blue }}>Performance Grades</td>
              <td colSpan={n - 1} className={td} style={{ background: C.blue }} />
            </tr>
            <tr>
              <td className={`${td} font-bold text-white`} style={{ background: C.teal }}>Property</td>
              {full(`PG ${spec.highGrade}`, C.teal, { bold: true, white: true, center: true })}
            </tr>
            <tr>
              {left(<b style={{ color: '#c0392b' }}>🌡️ Max. Design Temp. (°C)</b>, C.pink)}
              {selectedFull(spec.highGrade)}
            </tr>
            <tr>
              {left(<b>❄️ Min. Design Temp. (°C)</b>, C.lblue)}
              {perColumn(spec.columns.map((c) => c.lowGrade), C.lblue)}
            </tr>
            {head('🧪 Original Binder', C.purple)}
            <tr>{left(`≥${L.flashPointMinC} °C`)}{full('🔥 Flash Point', C.yellow)}</tr>
            <tr>{left(`≤${L.viscosityMaxPaS} Pa·s @ ${L.viscosityTestTempC} °C`)}{full('💧 Rotational Viscosity', C.lblue)}</tr>
            <tr>{left(`≥${L.originalDsrMinKPa.toFixed(2)} kPa`)}{full('⚙️ DSR G*/sin δ (Dynamic Shear Rheometer)', C.green)}</tr>
            <tr>{left('')}{selectedFull(spec.originalDsrTempC)}</tr>
            {head(`🔥 (Rolling Thin Film Oven) RTFO, Mass Change ≤ ${L.rtfoMassChangeMaxPct.toFixed(2)}%`, C.rtfo)}
            <tr>{left(`≥${L.rtfoDsrMinKPa.toFixed(2)} kPa`)}{full('⚙️ DSR G*/sin δ (Dynamic Shear Rheometer)', C.green)}</tr>
            <tr>{left('')}{selectedFull(spec.rtfoDsrTempC)}</tr>
            {head('🏺 (Pressure Aging Vessel) PAV', C.pav)}
            <tr>
              {left(`${L.pavAgingHours} hours, ${L.pavPressureMPa.toFixed(2)} MPa`, C.yellow)}
              {full(spec.pavAgingTempLabel.replace(' (', '('), C.yellow, { bold: true, center: true })}
            </tr>
            <tr>
              {left(`≤${L.pavDsrMaxKPa} kPa`)}
              {full('⚙️ DSR G*·sin δ (Dynamic Shear Rheometer) intermediate Temp = [(Max. + Min.)/2] + 4', C.lblue)}
            </tr>
            <tr>{left('')}{perColumn(spec.columns.map((c) => c.pavDsrTempC), C.lblue)}</tr>
            <tr>
              {left(<>S ≤ {L.bbrStiffnessMaxMPa} MPa<br />m ≥ {L.bbrMValueMin.toFixed(3)}</>)}
              {full('📊 BBR S (creep stiffness) & m-value (Bending Beam Rheometer)', C.lav)}
            </tr>
            <tr>{left('')}{perColumn(spec.columns.map((c) => c.bbrTempC), C.lav)}</tr>
            {head('📏 DTT (Direct Tension Tester)', C.dtt)}
            <tr>{left(<>ε<sub>f</sub> ≥ {L.dttFailureStrainMinPct.toFixed(2)}%</>)}{perColumn(spec.columns.map((c) => c.dttTempC), C.white)}</tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-justify font-serif text-[13px] italic text-[#555]">
        <b>Note:</b> The <span className="selected-grade-swatch">highlighted cells</span> (light shaded background) indicate the
        test temperatures corresponding to the project-selected PG grade. All values must meet the specified criteria for
        the binder to be certified for this performance grade according to AASHTO M320/M332 standards.
      </p>
      {!spec.inM320 && (
        <p className="mt-2 font-serif text-[13px] italic text-[#4b5563]">
          {gradeText(spec.label)} is not listed in AASHTO M320 Table 1; the test temperatures above follow the same rules.
        </p>
      )}
    </div>
  );
}
