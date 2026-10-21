/**
 * Sequential ramps for the heatmaps (one hue, light → dark). Blue is the dataviz reference blue ramp;
 * red is the same structure built on the reference red. Higher Tmax = darker red; colder Tmin = darker blue.
 */
export const RED_RAMP = ['#fde4e3', '#fbc9c7', '#f7a8a6', '#f08785', '#e86866', '#e34948', '#c63a3a', '#a12e2e', '#7a2222'];
export const BLUE_RAMP = ['#cde2fb', '#9ec5f4', '#86b6ef', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#184f95', '#0d366b'];

/** Colour for t in [0, 1] from a ramp, and whether text on it should be light. */
export function rampColor(ramp: readonly string[], t: number): { fill: string; lightText: boolean } {
  const i = Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))));
  return { fill: ramp[i], lightText: i >= Math.ceil(ramp.length / 2) };
}
