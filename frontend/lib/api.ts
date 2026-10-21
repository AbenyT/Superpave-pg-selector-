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
  /** The account that made it (null for analyses saved before accounts existed). */
  ownerId: string | null;
}

/** One line of "My analyses". */
export interface AnalysisSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  stationName: string | null;
  latitude: number;
  designEsalMillions: number;
  designSpeedKmh: number;
  climateGrade: string;
  finalGrade: string;
  binderType: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthResponse {
  accessToken: string;
  user: User;
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

// ---- Log-in token (kept in this browser) ---------------------------------------------------------------

const TOKEN_KEY = 'pg-selector-token';
const signedOutListeners = new Set<() => void>();

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the user stays signed in for this page only */
  }
}

/** Called when the API says the token is no longer valid (expired). Returns an unsubscribe function. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

// ---- Requests --------------------------------------------------------------------------------------------

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('The server could not be reached. Check your internet connection and try again.', 'OFFLINE', 0);
  }
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) signedOutListeners.forEach((listener) => listener());
    throw new ApiError(body.message ?? 'Something went wrong on the server. Please try again.', body.code ?? 'ERROR', res.status);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

/** Wakes the API up (Render's free plan sleeps); errors are ignored. */
export function wakeApi(): void {
  fetch(`${API_URL}/health`).catch(() => undefined);
}

export const register = (email: string, password: string, name?: string) =>
  call<AuthResponse>('/auth/register', json('POST', { email, password, ...(name ? { name } : {}) }));
export const login = (email: string, password: string) => call<AuthResponse>('/auth/login', json('POST', { email, password }));
export const me = () => call<User>('/auth/me');

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

export const listAnalyses = () => call<AnalysisSummary[]>('/analyses');

export function getAnalysis(id: string): Promise<AnalysisView> {
  return call<AnalysisView>(`/analyses/${encodeURIComponent(id)}`);
}

export function updateAnalysis(id: string, fields: Partial<FormFields>): Promise<AnalysisView> {
  return call<AnalysisView>(`/analyses/${encodeURIComponent(id)}`, json('PATCH', fields));
}

export function deleteAnalysis(id: string): Promise<void> {
  return call<void>(`/analyses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
