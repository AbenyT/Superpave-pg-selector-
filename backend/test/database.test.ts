/**
 * The same save / reopen / update flow against a real PostgreSQL database.
 * Runs only when TEST_DATABASE_URL is set, e.g. the local Docker database:
 *   docker compose up -d
 *   set TEST_DATABASE_URL=postgresql://pg:pg@localhost:5434/pgselector?schema=superpave
 */
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { syntheticStation } from '../../engine/test/helpers';
import { startApp, stationCsv } from './helpers';

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run('saving in PostgreSQL', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const created: string[] = [];
  const email = `db-check-${Date.now()}@example.com`;
  let auth: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    ({ app, http } = await startApp());
    const res = await http.post('/auth/register').send({ email, password: 'database-check' }).expect(201);
    auth = `Bearer ${res.body.accessToken}`;
  });

  afterAll(async () => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.analysis.deleteMany({ where: { id: { in: created } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    await app.close();
    delete process.env.DATABASE_URL;
  });

  it('health reports the database', async () => {
    const res = await http.get('/health').expect(200);
    expect(res.body).toMatchObject({ storage: 'database', database: 'up' });
  });

  it('saves, lists, reopens and updates an analysis under an account', async () => {
    const post = await http
      .post('/analyses')
      .set('Authorization', auth)
      .field('projectName', 'Database check')
      .field('designEsalMillions', '20')
      .field('designSpeedKmh', '100')
      .attach('file', stationCsv(syntheticStation(2005, 2015, 9), 'Test Station', 9.23), 'station.csv')
      .expect(201);
    created.push(post.body.id);

    const get = await http.get(`/analyses/${post.body.id}`).expect(200);
    expect(get.body).toEqual(post.body);

    const list = await http.get('/analyses').set('Authorization', auth).expect(200);
    expect(list.body.map((a: { id: string }) => a.id)).toEqual([post.body.id]);

    const patch = await http.patch(`/analyses/${post.body.id}`).set('Authorization', auth).send({ acceptConsiderBump: true }).expect(200);
    expect(patch.body.result.traffic.gradesAdded).toBe(1);
    expect(patch.body.climate).toEqual(post.body.climate);

    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const row = await prisma.analysis.findUniqueOrThrow({ where: { id: post.body.id } });
    await prisma.$disconnect();
    expect(row.finalGrade).toBe(patch.body.result.finalGrade.label);
    expect(row.acceptConsiderBump).toBe(true);
    expect(row.reliabilityPercent).toBe(98);
    expect(row.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    // The background data-quality report is stored, though the page never receives it.
    expect((row.climate as any).quality.rowsRead).toBeGreaterThan(0);
  });
});
