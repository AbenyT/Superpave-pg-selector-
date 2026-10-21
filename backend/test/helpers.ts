import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Observation } from '@pg/engine';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

export async function startApp(): Promise<{ app: INestApplication; http: ReturnType<typeof request> }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return { app, http: request(app.getHttpServer()) };
}

/** Daily list file: Date, Tmax, Tmin. */
export function dailyCsv(obs: readonly Observation[]): Buffer {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lines = obs.map((o) => `${o.year}-${pad(o.month)}-${pad(o.day)},${o.tmax ?? ''},${o.tmin ?? ''}`);
  return Buffer.from(['Date,Tmax,Tmin', ...lines].join('\n'));
}

/** Station file like TT_Meisso.csv: Name, GEOGR2 (latitude), element, Year, Month, 1 … 31. */
export function stationCsv(obs: readonly Observation[], name: string, latitude: number): Buffer {
  const rows = new Map<string, string[]>();
  for (const o of obs) {
    for (const [code, value] of [['TMPMAX', o.tmax], ['TMPMIN', o.tmin]] as const) {
      const key = `${code},${o.year},${o.month}`;
      if (!rows.has(key)) rows.set(key, new Array(31).fill(''));
      rows.get(key)![o.day - 1] = value === null || value === undefined ? 'X' : String(value);
    }
  }
  const header = 'Name,GEOGR2,element,Year,Month,' + Array.from({ length: 31 }, (_, i) => i + 1).join(',');
  const lines = [...rows].map(([key, days]) => `${name},${latitude},${key},${days.join(',')}`);
  return Buffer.from([header, ...lines].join('\n'));
}
