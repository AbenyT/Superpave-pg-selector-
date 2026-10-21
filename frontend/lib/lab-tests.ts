/** The laboratory tests of the specification, with the requirements for the selected grade (page, PDF, Excel). */
import type { SpecTable } from '@pg/engine';
import { signed } from './format';
import equipment from './lab-equipment.json';

export interface LabTest {
  id: string;
  name: string;
  device: string;
  standard: string;
  stage: string;
  color: string;
  purpose: string;
  svg: string;
  /** Requirements and test temperatures for the selected grade. */
  requirements: string[];
}

export function labTests(spec: SpecTable): LabTest[] {
  const L = spec.limits;
  const sel = spec.columns[spec.selectedIndex];
  const req: Record<string, string[]> = {
    flash: [`Flash point ≥ ${L.flashPointMinC} °C`],
    rv: [`Viscosity ≤ ${L.viscosityMaxPaS} Pa·s at ${L.viscosityTestTempC} °C`],
    dsr: [
      `Original binder: G*/sin δ ≥ ${L.originalDsrMinKPa.toFixed(2)} kPa at ${spec.originalDsrTempC} °C`,
      `RTFO residue: G*/sin δ ≥ ${L.rtfoDsrMinKPa.toFixed(2)} kPa at ${spec.rtfoDsrTempC} °C`,
      `PAV residue: G*·sin δ ≤ ${L.pavDsrMaxKPa} kPa at ${signed(sel.pavDsrTempC)} °C`,
    ],
    rtfo: [`Mass change ≤ ${L.rtfoMassChangeMaxPct.toFixed(2)}%`, '163 °C, 85 minutes'],
    pav: [`${spec.pavAgingTempLabel} °C, ${L.pavPressureMPa.toFixed(2)} MPa, ${L.pavAgingHours} hours`],
    bbr: [`S ≤ ${L.bbrStiffnessMaxMPa} MPa and m ≥ ${L.bbrMValueMin.toFixed(3)} at ${signed(sel.bbrTempC)} °C`],
    dtt: [`Failure strain ≥ ${L.dttFailureStrainMinPct.toFixed(2)}% at ${signed(sel.dttTempC)} °C`],
  };
  return equipment.tests.map((t) => ({ ...t, requirements: req[t.id] ?? [] }));
}
