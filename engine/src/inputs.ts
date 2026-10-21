/** Design inputs and their checks (used by both the page and the API). */

export interface DesignInputs {
  /** Degrees; north positive. */
  latitude: number;
  designEsalMillions: number;
  designSpeedKmh: number;
  /** Add one grade where M323 says "consider". Default false. */
  acceptConsiderBump?: boolean;
}

export const INPUT_LIMITS = {
  latitude: { min: -90, max: 90 },
  designEsalMillions: { min: 0, max: 1000 },
  designSpeedKmh: { min: 0, max: 200 },
} as const;

export interface InputProblem {
  field: keyof DesignInputs;
  message: string;
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateDesignInputs(inputs: DesignInputs): InputProblem[] {
  const problems: InputProblem[] = [];
  const range = (field: keyof typeof INPUT_LIMITS, name: string, unit: string) => {
    const v = inputs[field];
    const { min, max } = INPUT_LIMITS[field];
    if (!isNumber(v) || v < min || v > max) {
      problems.push({ field, message: `${name} must be a number from ${min} to ${max}${unit}.` });
    }
  };
  range('latitude', 'Latitude', '°');
  range('designEsalMillions', 'Design ESAL', ' million');
  range('designSpeedKmh', 'Design speed', ' km/h');
  return problems;
}
