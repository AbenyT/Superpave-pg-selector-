/** Even axis ticks at 0.5 / 1 / 2 / 5 / 10 °C steps, with the domain snapped to them. */
export function niceAxis(lo: number, hi: number): { domain: [number, number]; ticks: number[] } {
  const raw = (hi - lo) / 5;
  const step = [0.5, 1, 2, 5, 10].find((s) => s >= raw) ?? 10;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10);
  return { domain: [start, end], ticks };
}

/** Domain with breathing room around the data and reference values. */
export function chartAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.6, (hi - lo) * 0.15);
  return niceAxis(lo - pad, hi + pad);
}
