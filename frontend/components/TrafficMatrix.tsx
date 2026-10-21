/** AASHTO M323 Table 1 with the project's traffic cell highlighted. */
import { ESAL_CLASSES, GRADE_BUMP_TABLE, type BumpCell, type SpeedClass, type TrafficAdjustment } from '@pg/engine';
import { Switch } from './ui';

const SPEEDS: { id: SpeedClass; label: string; sub: string }[] = [
  { id: 'standing', label: 'Standing', sub: '< 20 km/h' },
  { id: 'slow', label: 'Slow', sub: '20–70 km/h' },
  { id: 'standard', label: 'Standard', sub: '> 70 km/h' },
];

function cellText(cell: BumpCell): string {
  if (cell === 'consider') return 'consider +1';
  return cell === 0 ? '—' : `+${cell}`;
}

export function TrafficMatrix({
  traffic,
  esal,
  speed,
  onConsider,
}: {
  traffic: TrafficAdjustment;
  esal: number;
  speed: number;
  onConsider: (value: boolean) => void;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="bg-raised text-xs text-muted">
              <th className="px-3 py-2 text-left font-semibold">Design ESAL (million)</th>
              {SPEEDS.map((s) => (
                <th key={s.id} className={`px-3 py-2 text-center font-semibold ${s.id === traffic.speedClass ? 'text-ink' : ''}`}>
                  {s.label}
                  <div className="font-normal">{s.sub}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ESAL_CLASSES.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className={`px-3 py-2 ${e.id === traffic.esalClass ? 'font-semibold' : 'text-muted'}`}>{e.label}</td>
                {SPEEDS.map((s) => {
                  const here = e.id === traffic.esalClass && s.id === traffic.speedClass;
                  return (
                    <td key={s.id} className="px-2 py-1.5 text-center">
                      <span className={`inline-block min-w-16 rounded-md px-2 py-1 ${here ? 'bg-ok-soft font-bold text-ok ring-2 ring-ok' : 'text-muted'}`}>
                        {cellText(GRADE_BUMP_TABLE[e.id][s.id])}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-subtle">
        Your project: {esal} million ESAL at {speed} km/h. Each step adds one high-temperature grade (6 °C); the low grade does not change.
      </p>
      {traffic.isConsiderCase && (
        <div className="mt-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
          <p className="mb-2 text-warn">AASHTO M323 says to consider increasing the high temperature grade by one grade for this traffic.</p>
          <Switch checked={traffic.gradesAdded === 1} onChange={onConsider} label="Add one grade" />
        </div>
      )}
      {traffic.cappedAtMax && <p className="mt-2 text-sm text-warn">Limited to PG 88, the highest grade.</p>}
    </div>
  );
}
