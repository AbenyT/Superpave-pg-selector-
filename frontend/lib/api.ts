/** Talks to the NestJS API. Every error reply is { message, code }; the page shows the message as it is. */
import type { ClimateAnalysis, DesignInputs, GradeResult } from '@pg/engine';
import type { StationInfo } from '@pg/parser';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100').replace(/\/$/, '');

export type ClimateView = Omit<ClimateAnalysis, 'quality'>;

export interface AnalysisView {
  id: string;
  createdAt: string;
  updatedAt: string;
  engineVersion: string;
  projectName: string;
  stationName: string | null;
  inputs: Required<DesignInputs>;
  file: { name: string };
  station: StationInfo;
  climate: ClimateView;
  result: GradeResult;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError('The server could not be reached. Check your internet connection and try again.', 'OFFLINE', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.message ?? 'Something went wrong on the server. Please try again.', body.code ?? 'ERROR', res.status);
  }
  return body as T;
}

/** Wakes the API up (Render's free plan sleeps); errors are ignored. */
export function wakeApi(): void {
  fetch(`${API_URL}/health`).catch(() => undefined);
}

export interface FormFields {
  projectName: string;
  stationName: string;
  latitude: number;
  designEsalMillions: number;
  designSpeedKmh: number;
  acceptConsiderBump: boolean;
}

export function createAnalysis(file: File, fields: FormFields): Promise<AnalysisView> {
  const form = new FormData();
  form.append('file', file);
  form.append('projectName', fields.projectName);
  if (fields.stationName) form.append('stationName', fields.stationName);
  form.append('latitude', String(fields.latitude));
  form.append('designEsalMillions', String(fields.designEsalMillions));
  form.append('designSpeedKmh', String(fields.designSpeedKmh));
  form.append('acceptConsiderBump', String(fields.acceptConsiderBump));
  return call<AnalysisView>('/analyses', { method: 'POST', body: form });
}

export function getAnalysis(id: string): Promise<AnalysisView> {
  return call<AnalysisView>(`/analyses/${encodeURIComponent(id)}`);
}

export function updateAnalysis(id: string, fields: Partial<FormFields>): Promise<AnalysisView> {
  return call<AnalysisView>(`/analyses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}
