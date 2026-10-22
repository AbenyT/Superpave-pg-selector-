/**
 * The real API (same setup as main.ts) with analyses kept in memory, so no database is needed.
 * database.test.ts runs the same flow against PostgreSQL.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { analyse, ENGINE_VERSION } from '@pg/engine';
import { syntheticStation } from '../../engine/test/helpers';
import { dailyCsv, startApp, stationCsv } from './helpers';

delete process.env.DATABASE_URL;
process.env.CORS_ORIGINS = 'http://localhost:3100,https://pg-selector-*.vercel.app';

const STATION = syntheticStation(2005, 2024, 42);
const FORM = { projectName: 'Meisso – Dire Dawa', designEsalMillions: '115.6', designSpeedKmh: '100' };

describe('Superpave PG API', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let auth: string;

  beforeAll(async () => {
    ({ app, http } = await startApp());
    const res = await http.post('/auth/register').send({ email: 'Engineer@Example.com ', password: 'asphalt-2026', name: 'Test' });
    auth = `Bearer ${res.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function upload(file: Buffer | null, fields: Record<string, string> = FORM, fileName = 'station.csv') {
    const req = http.post('/analyses').set('Authorization', auth);
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    if (file) req.attach('file', file, fileName);
    return req;
  }

  it('GET /health says the server is up and where analyses are kept', async () => {
    const res = await http.get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', storage: 'memory', database: 'not used', engineVersion: ENGINE_VERSION });
  });

  describe('a full analysis', () => {
    let saved: Record<string, any>;

    it('POST /analyses reads the file, takes latitude and station name from it, and saves the result', async () => {
      const res = await upload(stationCsv(STATION, 'Meiso Mission', 9.23)).expect(201);
      saved = res.body;
      expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(saved).toMatchObject({
        projectName: 'Meisso – Dire Dawa',
        stationName: 'Meiso Mission',
        inputs: { latitude: 9.23, designEsalMillions: 115.6, designSpeedKmh: 100, acceptConsiderBump: false },
        file: { name: 'station.csv' },
        station: { name: 'Meiso Mission', latitude: 9.23 },
        engineVersion: ENGINE_VERSION,
      });
      expect(saved.climate.high.years).toHaveLength(20);
      expect(saved.climate.low.years).toHaveLength(20);
      expect(saved.result.reliabilityPercent).toBe(98);
    });

    it('gives exactly the engine result (the server re-reads the file itself)', () => {
      const direct = analyse(STATION, { latitude: 9.23, designEsalMillions: 115.6, designSpeedKmh: 100 });
      expect(saved.result).toEqual(JSON.parse(JSON.stringify(direct.grade)));
    });

    it('does not send the background data-quality report to the page', () => {
      expect(saved.climate.quality).toBeUndefined();
    });

    it('GET /analyses/:id reopens it', async () => {
      const res = await http.get(`/analyses/${saved.id}`).expect(200);
      expect(res.body).toEqual(saved);
    });

    it('PATCH /analyses/:id recalculates without the file (the "consider" toggle)', async () => {
      // 20 M ESAL at 100 km/h is a "consider +1 grade" case.
      const off = await http.patch(`/analyses/${saved.id}`).set('Authorization', auth).send({ designEsalMillions: 20 }).expect(200);
      expect(off.body.result.traffic.isConsiderCase).toBe(true);
      expect(off.body.result.traffic.gradesAdded).toBe(0);

      const on = await http.patch(`/analyses/${saved.id}`).set('Authorization', auth).send({ acceptConsiderBump: true }).expect(200);
      expect(on.body.inputs).toMatchObject({ designEsalMillions: 20, acceptConsiderBump: true });
      expect(on.body.result.traffic.gradesAdded).toBe(1);
      expect(on.body.result.finalGrade.high).toBe(off.body.result.finalGrade.high + 6);
      expect(on.body.climate).toEqual(saved.climate);

      const reopened = await http.get(`/analyses/${saved.id}`).expect(200);
      expect(reopened.body.result).toEqual(on.body.result);
    });

    it('PATCH can rename the project and station', async () => {
      const res = await http.patch(`/analyses/${saved.id}`).set('Authorization', auth).send({ projectName: 'Lot 2', stationName: 'Meiso' }).expect(200);
      expect(res.body).toMatchObject({ projectName: 'Lot 2', stationName: 'Meiso' });
    });
  });

  describe('form values', () => {
    it('accepts decimal commas and a latitude typed in the form (it wins over the file)', async () => {
      const res = await upload(stationCsv(STATION, 'S', 9.23), { ...FORM, designEsalMillions: '115,6', latitude: '12,5' }).expect(201);
      expect(res.body.inputs).toMatchObject({ designEsalMillions: 115.6, latitude: 12.5 });
    });

    it('asks for the latitude when neither the form nor the file has it', async () => {
      const res = await upload(dailyCsv(STATION)).expect(400);
      expect(res.body).toEqual({ message: 'Enter the latitude of the station.', code: 'INVALID_INPUT' });
    });

    it.each([
      [{ projectName: '' }, 'Enter a project name.'],
      [{ designEsalMillions: 'abc' }, 'Design ESAL must be a number from 0 to 1000 million.'],
      [{ designEsalMillions: '-1' }, 'Design ESAL must be a number from 0 to 1000 million.'],
      [{ designSpeedKmh: '' }, 'Design speed must be a number from 0 to 200 km/h.'],
      [{ latitude: '95' }, 'Latitude must be a number from -90 to 90°.'],
      [{ acceptConsiderBump: 'maybe' }, 'The "consider one grade" choice must be true or false.'],
      [{ reliability: '50' }, 'Unknown field "reliability".'],
    ])('rejects %p with one plain message', async (patch, message) => {
      const res = await upload(dailyCsv(STATION), { ...FORM, latitude: '9.23', ...patch }).expect(400);
      expect(res.body).toEqual({ message, code: 'INVALID_INPUT' });
    });

    it('PATCH checks its fields too', async () => {
      const created = await upload(dailyCsv(STATION), { ...FORM, latitude: '9' }).expect(201);
      const res = await http.patch(`/analyses/${created.body.id}`).set('Authorization', auth).send({ designSpeedKmh: 500 }).expect(400);
      expect(res.body.message).toBe('Design speed must be a number from 0 to 200 km/h.');
    });
  });

  describe('file and data problems: one plain message', () => {
    it('no file', async () => {
      const res = await upload(null).expect(400);
      expect(res.body).toEqual({ message: 'Upload a temperature file (CSV or Excel).', code: 'NO_FILE' });
    });

    it('a file without temperature data', async () => {
      const res = await upload(Buffer.from('hello,world\n1,2\n'), FORM, 'notes.csv').expect(422);
      expect(res.body.code).toBe('BAD_FILE');
      expect(res.body.message).toMatch(/^The temperature data could not be found/);
    });

    it('too few years', async () => {
      const res = await upload(dailyCsv(syntheticStation(2020, 2022, 1)), { ...FORM, latitude: '9' }).expect(422);
      expect(res.body).toEqual({
        message: 'Only 3 years have enough maximum temperature (Tmax) data. At least 5 years with 75% of days recorded are needed.',
        code: 'TOO_FEW_YEARS_HIGH',
      });
    });

    it('a file over 10 MB', async () => {
      const res = await upload(Buffer.alloc(10 * 1024 * 1024 + 1, 65)).expect(413);
      expect(res.body.message).toBe('The file is larger than 10 MB. Upload one station at a time.');
    });
  });

  describe('accounts', () => {
    it('register gives a token, stores the email in lower case and never returns the password', async () => {
      const res = await http.post('/auth/register').send({ email: ' New@Example.com', password: 'bitumen-70-10' }).expect(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toEqual({ id: expect.any(String), email: 'new@example.com', name: null, isAdmin: false });
      expect(JSON.stringify(res.body)).not.toContain('bitumen');
    });

    it('one account per email', async () => {
      const res = await http.post('/auth/register').send({ email: 'engineer@example.com', password: 'another-pass' }).expect(409);
      expect(res.body).toEqual({ message: 'An account with this email already exists. Log in instead.', code: 'EMAIL_TAKEN' });
    });

    it.each([
      [{ email: 'not-an-email', password: 'asphalt-2026' }, 'Enter a valid email address.'],
      [{ email: 'a@b.com', password: 'short' }, 'The password must be at least 8 characters.'],
    ])('register rejects %p', async (body, message) => {
      const res = await http.post('/auth/register').send(body).expect(400);
      expect(res.body).toEqual({ message, code: 'INVALID_INPUT' });
    });

    it('login with the right password; one message for a wrong email or password', async () => {
      const ok = await http.post('/auth/login').send({ email: 'ENGINEER@example.com', password: 'asphalt-2026' }).expect(200);
      expect(ok.body.user).toMatchObject({ email: 'engineer@example.com', name: 'Test' });
      for (const body of [{ email: 'engineer@example.com', password: 'wrong-one' }, { email: 'nobody@example.com', password: 'asphalt-2026' }]) {
        const bad = await http.post('/auth/login').send(body).expect(401);
        expect(bad.body).toEqual({ message: 'Wrong email or password.', code: 'WRONG_LOGIN' });
      }
    });

    it('GET /auth/me needs a valid token', async () => {
      const me = await http.get('/auth/me').set('Authorization', auth).expect(200);
      expect(me.body.email).toBe('engineer@example.com');
      const res = await http.get('/auth/me').set('Authorization', 'Bearer nonsense').expect(401);
      expect(res.body).toEqual({ message: 'Your session has expired. Please log in again.', code: 'SIGNED_OUT' });
    });

    it('a new analysis needs a log-in', async () => {
      const res = await http.post('/analyses').field('projectName', 'X').attach('file', dailyCsv(STATION), 'a.csv').expect(401);
      expect(res.body).toEqual({ message: 'Please log in first.', code: 'SIGNED_OUT' });
    });

    it('lists only my analyses; others can open a link but not change or delete it', async () => {
      const mine = await upload(dailyCsv(STATION), { ...FORM, projectName: 'Mine', latitude: '9' }).expect(201);
      expect(mine.body.ownerId).toEqual(expect.any(String));

      const other = await http.post('/auth/register').send({ email: 'other@example.com', password: 'other-pass-1' }).expect(201);
      const otherAuth = `Bearer ${other.body.accessToken}`;

      const list = await http.get('/analyses').set('Authorization', auth).expect(200);
      expect(list.body[0]).toMatchObject({
        id: mine.body.id, projectName: 'Mine', finalGrade: mine.body.result.finalGrade.label,
        binderType: mine.body.result.binderType.name, latitude: 9,
      });
      expect(list.body[0].climate).toBeUndefined();
      expect((await http.get('/analyses').set('Authorization', otherAuth).expect(200)).body).toEqual([]);
      await http.get('/analyses').expect(401);

      await http.get(`/analyses/${mine.body.id}`).expect(200);
      const patch = await http.patch(`/analyses/${mine.body.id}`).set('Authorization', otherAuth).send({ projectName: 'Taken' }).expect(403);
      expect(patch.body).toEqual({ message: 'Only the person who made this analysis can change it.', code: 'NOT_OWNER' });
      await http.delete(`/analyses/${mine.body.id}`).set('Authorization', otherAuth).expect(403);
      await http.patch(`/analyses/${mine.body.id}`).send({ projectName: 'Taken' }).expect(401);

      await http.delete(`/analyses/${mine.body.id}`).set('Authorization', auth).expect(204);
      await http.get(`/analyses/${mine.body.id}`).expect(404);
    });
  });

  describe('site statistics (owner only)', () => {
    afterAll(() => {
      delete process.env.ADMIN_EMAILS;
    });

    it('other accounts and visitors are refused', async () => {
      const res = await http.get('/admin/stats').set('Authorization', auth).expect(403);
      expect(res.body).toEqual({ message: 'This page is only for the site owner.', code: 'NOT_ADMIN' });
      await http.get('/admin/stats').expect(401);
    });

    it('the owner sees counts only: accounts, analyses, 30 days and grades', async () => {
      process.env.ADMIN_EMAILS = 'owner@example.com';
      const owner = await http.post('/auth/register').send({ email: 'Owner@Example.com', password: 'owner-pass-1' }).expect(201);
      expect(owner.body.user.isAdmin).toBe(true);
      const res = await http.get('/admin/stats').set('Authorization', `Bearer ${owner.body.accessToken}`).expect(200);
      expect(res.body.accounts.total).toBeGreaterThanOrEqual(3);
      expect(res.body.accounts.last7Days).toBe(res.body.accounts.total);
      expect(res.body.analyses.total).toBeGreaterThan(0);
      expect(res.body.perDay).toHaveLength(30);
      expect(res.body.perDay.reduce((n: number, d: { signUps: number }) => n + d.signUps, 0)).toBe(res.body.accounts.total);
      expect(res.body.grades[0]).toEqual({ grade: expect.stringMatching(/^PG /), count: expect.any(Number) });
      expect(JSON.stringify(res.body)).not.toContain('@');
    });
  });

  describe('unknown analyses and addresses', () => {
    it.each(['not-a-uuid', '00000000-0000-4000-8000-000000000000'])('GET /analyses/%s → 404', async (id) => {
      const res = await http.get(`/analyses/${id}`).expect(404);
      expect(res.body).toEqual({ message: 'This analysis was not found.', code: 'NOT_FOUND' });
    });

    it('an unknown address → 404', async () => {
      const res = await http.get('/nothing-here').expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('browser access (CORS)', () => {
    it.each(['http://localhost:3100', 'https://pg-selector-abc123.vercel.app'])('allows %s', async (origin) => {
      const res = await http.get('/health').set('Origin', origin).expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    });

    it('does not allow other sites', async () => {
      const res = await http.get('/health').set('Origin', 'https://evil.example').expect(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  const MEISSO = join(__dirname, '..', '..', 'parser', 'test', 'fixtures', 'private', 'TT_Meisso.csv');
  (existsSync(MEISSO) ? it : it.skip)('the real TT_Meisso.csv gives PG 64-10 → PG 70-10', async () => {
    const res = await upload(readFileSync(MEISSO), FORM, 'TT_Meisso.csv').expect(201);
    expect(res.body.inputs.latitude).toBe(9.23);
    expect(res.body.stationName).toBe('Meiso Mission');
    expect(res.body.result.climateGrade.label).toBe('PG 64-10');
    expect(res.body.result.finalGrade.label).toBe('PG 70-10');
    expect(res.body.result.spec.title).toBe('Specification for Bitumen with Performance Grade PG 70-10');
  });
});
