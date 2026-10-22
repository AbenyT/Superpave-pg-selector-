# Superpave PG Binder Selector

Upload daily temperature data and get the Superpave PG binder grade with its
specification table (AASHTO M320 / M323, SHRP and LTPP models).

Prepared by Abenezer Tilahun.

## Folders

| Folder | What it is |
|---|---|
| `engine/` | All calculations, pure TypeScript, with Jest tests. Used by both the backend and the page. |
| `parser/` | Reads uploaded CSV / Excel files in any common layout and extracts the daily Tmax and Tmin. |
| `backend/` | NestJS API: re-reads the uploaded file, runs the engine and saves each analysis (Prisma → Supabase PostgreSQL). |
| `frontend/` | Next.js site: landing page, log-in / sign-up, "My analyses" dashboard, and the analysis page (graphs, heatmaps, SHRP/LTPP formulas, grade and specification table, PDF / Excel / PNG export). |

## Run the tests

```bash
npm install
npm test
```

## Run the API on your PC

1. Build everything: `npm run build`
2. Create `backend/.env` by copying `backend/.env.example`. If `DATABASE_URL` is empty, analyses are kept in memory.
3. Start the API: `npm run start:api`. It runs at http://localhost:4100 (the health check is at http://localhost:4100/health).

To test with a real local database (needs Docker Desktop):

```bash
docker compose up -d
```

Then set `DATABASE_URL` and `DIRECT_URL` in `backend/.env` to `postgresql://pg:pg@localhost:5434/pgselector?schema=superpave`, and run `npm run db:deploy --workspace backend`.

### Pages

| Address | What it is |
|---|---|
| `/` | Landing page with a sign-up form. Old links `/?a=<id>` are sent on to `/analyse?a=<id>`. |
| `/register`, `/login` | Create an account / log in (email + password, as in the AASHTO 1993 app). |
| `/dashboard` | My analyses: open or delete them. |
| `/admin` | Site statistics for the owner (accounts, analyses, per day, grades). Visitor numbers are in Vercel → project → Analytics. |
| `/analyse` | A new analysis (needs an account). |
| `/analyse?a=<id>` | A saved analysis. Anyone with the link can look; only the owner's changes are saved. |

Site details (name, author, email, LinkedIn) are in `frontend/lib/site.ts`. Landing photos are in `frontend/public/landing/`.

### API

| Request | What it does |
|---|---|
| `GET /health` | Server status and where analyses are saved. The page calls it on load to wake up Render. |
| `POST /auth/register` | `{ email, password, name? }` → `{ accessToken, user }`. Passwords are stored as bcrypt hashes only. |
| `POST /auth/login` | `{ email, password }` → `{ accessToken, user }`. |
| `GET /auth/me` | The logged-in user (send `Authorization: Bearer <token>`). |
| `POST /analyses` | Logged in. Multipart form with `file`, `projectName`, `designEsalMillions` and `designSpeedKmh`. Optional fields: `stationName`, `latitude` (taken from the file if blank) and `acceptConsiderBump`. Returns the saved analysis. |
| `GET /analyses` | Logged in. My analyses, newest first (summary only). |
| `GET /analyses/:id` | Reopens a saved analysis (anyone with the link). |
| `PATCH /analyses/:id` | Owner only. Changes any of the inputs (JSON, no file). The grade is recalculated from the saved yearly results. |
| `DELETE /analyses/:id` | Owner only. |
| `GET /admin/stats` | Site owner only (`ADMIN_EMAILS`, default the author's email). Counts only, no names or emails. |

Every error reply is `{ "message": "one plain sentence", "code": "…" }`. The data-quality report is saved in the database but never sent to the page.

## Online (deployment)

| Part | Service | Settings |
|---|---|---|
| API | Render (free, Frankfurt) | Blueprint `render.yaml`; variables `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGINS`, `JWT_SECRET` (if it is missing, a key is derived from `DATABASE_URL`) |
| Database | Supabase project `superpave-pg` | Session pooler string ending with `?schema=superpave`; tables `analyses` and `users` |
| Web page | Vercel | Root Directory `frontend` (`frontend/vercel.json` builds the engine first); variable `NEXT_PUBLIC_API_URL` = the Render address |

Every push to `main` deploys again automatically.

## Exports (made in the browser)

- **PDF report:**
  - Result summary, 7-day maximum and annual minimum (graph, statistics and table), Tmax and Tmin heatmaps, the SHRP and LTPP formulas with numbers, the M323 traffic table and the specification table.
  - An appendix with every calculation step.
  - File author: Abenezer Tilahun. Example: `docs/samples/`.
- **Excel:**
  - Sheets: Summary, 7-day maximum, Annual minimum, Heatmap Tmax and Tmin (coloured cells), Specification (same colours) and Calculation.
  - Creator: Abenezer Tilahun.
- **PNG:** one button on each graph and each heatmap, for print-quality pictures.

## File layouts the parser reads

Column names are recognised in many spellings, for example TMPMAX, Tmax, TX, "Max Temp (°C)", "Maximum temperature". Extra columns are ignored.

- **Station layout:** Name, element, Year, Month, 1 … 31 (e.g. NMA files with GEOGR2 = latitude, GEOGR1, ELEVATION, Time).
- **Daily list:** Date, Tmax, Tmin, or Year, Month, Day, Tmax, Tmin.
- **Element list:** Date, Element, Value.
- **Month columns:** Year, Day, Jan … Dec.
- **Tmax and Tmin kept separately:** in different sheets or blocks, the element is read from the sheet name, a title row or the file name.
- **No usable column names:** the parser finds the date column and the two temperature columns from the values.
- **Missing readings:** X, N/a, "-" or a blank cell. Decimal commas are accepted. °F columns are converted to °C.
- **Station details:** name, latitude, longitude and elevation are taken from columns or from lines such as "Latitude: 9.23".

Your own station files can be put in `parser/test/fixtures/private/`. This folder is never committed, and `meisso.test.ts` runs only when TT_Meisso.csv is there.

## Calculation rules (engine version 1.3.0)

- **Cleaning:**
  - Invalid calendar dates are dropped.
  - For a repeated date, the first value is kept, unless that first copy is blank.
  - Values outside −50…+60 °C are treated as missing.
  - If Tmax < Tmin on a day, both values are treated as missing.
- **Gaps:**
  - Gaps of 3 days or less are filled by linear interpolation.
  - Longer gaps are filled with the long-term mean of that calendar month.
- **Years:** a year is used only if at least 75% of its days are measured, checked separately for Tmax and Tmin. At least 5 usable years are needed.
- **7-day maximum:** the hottest 7 consecutive calendar days of Tmax inside each year. Measured and interpolated days count; monthly-mean days and missing days do not.
- **Annual minimum:** the lowest Tmin of each year, using the same day rule.
- **Heatmaps:** the monthly mean Tmax and Tmin for every year, from measured and interpolated days only. A month with fewer than half of its days recorded shows as "no data".
- **Reliability:** fixed at 98% (z = 2.0537). There is no 50% option.
  - T_air = mean_7day + z·σ_7day
  - T_20mm = (T_air − 0.00618·Lat² + 0.2289·Lat + 42.2)·0.9545 − 17.78
  - T_pav,low = −1.56 + 0.72·T_air,low − 0.004·Lat² + 6.26·log10(0 + 25) − z·√(4.4 + 0.52·σ²)
- **Rounding:** the high grade is rounded up to 46…88. The low grade is rounded down to −10…−46.
- **Traffic:** AASHTO M323 Table 1 bumping, set in `engine/src/config/gradeBumping.ts`. The low grade does not change. The result is capped at PG 88.
- **Binder type:** crude oil, high-quality crude oil or modifier required, from the chart for crude oil blends (`engine/src/config/binderType.ts`), plus the rule-of-90 check.
- **Specification table:**
  - DSR tests at the high grade temperature.
  - PAV DSR at (high + low)/2 + 4.
  - BBR and DTT at low + 10.
  - PAV ageing temperature by grade, from M320 Table 1.
