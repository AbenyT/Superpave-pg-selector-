// Parity check, TypeScript side: writes test files into colab/parity/files/ (git-ignored) and
// saves what the TypeScript parser + engine make of each one to colab/parity/ts_results.json.
// Run from the repository root after `npm run build`:  node colab/parity/make_and_run_ts.js
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { readTemperatureFile } = require('@pg/parser');
const { analyse } = require('@pg/engine');

const dir = path.join(__dirname, 'files');
fs.mkdirSync(dir, { recursive: true });

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Daily values with a season, random weather, gaps and a few bad values. */
function station(first, last, seed) {
  const r = rand(seed);
  const days = [];
  for (let y = first; y <= last; y++) {
    const n = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.UTC(y, 0, 1 + i));
      const season = Math.sin((2 * Math.PI * (i - 80)) / n);
      let tmax = Math.round((28 + 5 * season + (r() - 0.5) * 7) * 10) / 10;
      let tmin = Math.round((tmax - 13 - r() * 5) * 10) / 10;
      const roll = r();
      if (roll < 0.03) tmax = null; // missing
      else if (roll < 0.035) tmin = null;
      else if (roll < 0.036) tmin = 162; // impossible
      else if (roll < 0.037) [tmax, tmin] = [tmin, tmax]; // Tmax < Tmin
      days.push({ y, m: d.getUTCMonth() + 1, d: d.getUTCDate(), tmax, tmin });
    }
  }
  // A long gap (40 days) in the third year, so that year is dropped.
  const start = days.findIndex((x) => x.y === first + 2 && x.m === 3);
  for (let k = start; k < start + 40; k++) days[k].tmax = null;
  return days;
}

const pad = (n) => String(n).padStart(2, '0');
const v = (x) => (x === null ? 'X' : String(x));

function wideCsv(days, name, lat) {
  const rows = new Map();
  for (const x of days) {
    for (const [code, val] of [['TMPMAX', x.tmax], ['TMPMIN', x.tmin]]) {
      const key = `${code},${x.y},${x.m}`;
      if (!rows.has(key)) rows.set(key, new Array(31).fill(''));
      rows.get(key)[x.d - 1] = v(val);
    }
  }
  const header = 'Name,GEOGR2,GEOGR1,ELEVATION,element,Year,Month,Time,' + Array.from({ length: 31 }, (_, i) => i + 1).join(',');
  return [header, ...[...rows].map(([k, d]) => `${name},${lat},40.1,1500,${k},18:00,${d.join(',')}`)].join('\r\n');
}

const files = {};
const add = (name, content) => {
  fs.writeFileSync(path.join(dir, name), content);
  files[name] = true;
};

const A = station(2003, 2016, 11);
const B = station(1995, 2010, 22);
const C = station(2010, 2021, 33);
add('wide_station.csv', '﻿' + wideCsv(A, 'Test Station A', 8.75) + '\r\nX= NO DATA,,,\r\n');
add('daily_semicolon.csv', 'Date;Tmax (°C);Tmin (°C);Rain (mm)\n' +
  B.map((x) => `${pad(x.d)}/${pad(x.m)}/${x.y};${v(x.tmax).replace('.', ',')};${v(x.tmin).replace('.', ',')};0`).join('\n'));
add('ymd_tx_tn.csv', 'Station: Bole\nLatitude: 8.98\nElevation (m): 2354\n\nTN,DAY,TX,MONTH,YEAR\n' +
  C.map((x) => `${v(x.tmin)},${x.d},${v(x.tmax)},${x.m},${x.y}`).join('\n'));
add('long_element.csv', 'Date,Element,Value\n' +
  C.flatMap((x) => [`${x.y}-${pad(x.m)}-${pad(x.d)},TMPMAX,${v(x.tmax)}`, `${x.y}-${pad(x.m)}-${pad(x.d)},TMPMIN,${v(x.tmin)}`,
    `${x.y}-${pad(x.m)}-${pad(x.d)},RAIN,0`]).join('\n'));
add('no_names.csv', 'a,b,c\n' + A.map((x) => `${x.y}-${pad(x.m)}-${pad(x.d)},${v(x.tmin)},${v(x.tmax)}`).join('\n'));
add('fahrenheit.csv', 'Date,Tmax (°F),Tmin (°F)\n' +
  B.map((x) => `${x.y}-${pad(x.m)}-${pad(x.d)},${x.tmax === null ? '' : Math.round((x.tmax * 9 / 5 + 32) * 10) / 10},${x.tmin === null ? '' : Math.round((x.tmin * 9 / 5 + 32) * 10) / 10}`).join('\n'));

// Excel: real dates.
{
  const wb = XLSX.utils.book_new();
  const rows = [['Date', 'Max Temp', 'Min Temp'], ...C.map((x) => [new Date(x.y, x.m - 1, x.d), x.tmax, x.tmin])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), 'Daily');
  add('excel_dates.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
// Excel: Year, Day, Jan … Dec in a Tmax sheet and a Tmin sheet.
{
  const wb = XLSX.utils.book_new();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const [sheet, key] of [['Tmax', 'tmax'], ['Tmin', 'tmin']]) {
    const rows = [['Station: Dire Dawa'], ['Year', 'Day', ...months]];
    for (let y = 2003; y <= 2016; y++) {
      for (let d = 1; d <= 31; d++) {
        rows.push([y, d, ...months.map((_, m) => {
          const x = A.find((o) => o.y === y && o.m === m + 1 && o.d === d);
          return x ? (x[key] === null ? 'X' : x[key]) : null;
        })]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  }
  add('month_columns.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
// Two titled blocks, no element column.
{
  const block = (title, key) => {
    const lines = [title, 'Year,Month,' + Array.from({ length: 31 }, (_, i) => i + 1).join(',')];
    for (let y = 2010; y <= 2021; y++) {
      for (let m = 1; m <= 12; m++) {
        const vals = Array.from({ length: 31 }, (_, i) => {
          const x = C.find((o) => o.y === y && o.m === m && o.d === i + 1);
          return x ? v(x[key]) : '';
        });
        lines.push(`${y},${m},${vals.join(',')}`);
      }
    }
    return lines.join('\n');
  };
  add('titled_blocks.csv', block('Daily Maximum Temperature (°C)', 'tmax') + '\n\n' + block('Daily Minimum Temperature (°C)', 'tmin'));
}
// Problems.
add('only_tmin.csv', 'Date,Tmin\n' + C.map((x) => `${x.y}-${pad(x.m)}-${pad(x.d)},${v(x.tmin)}`).join('\n'));
add('two_stations.csv', wideCsv(A.slice(0, 60), 'A', 9) + '\n' + wideCsv(A.slice(60, 120), 'B', 9).split('\n').slice(1).join('\n'));
add('too_few_years.csv', wideCsv(station(2019, 2021, 5), 'Short', 9.1));
add('rain_only.csv', 'Date,Element,Value\n2020-01-01,RAIN,3\n2020-01-01,RH,60\n');
add('notes.csv', 'hello,world\n1,2\n');

const meisso = path.join(__dirname, '..', '..', 'parser', 'test', 'fixtures', 'private', 'TT_Meisso.csv');
if (fs.existsSync(meisso)) {
  fs.copyFileSync(meisso, path.join(dir, 'TT_Meisso.csv'));
  files['TT_Meisso.csv'] = true;
}

const results = {};
for (const name of Object.keys(files)) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(dir, name)));
  try {
    const parsed = readTemperatureFile(bytes, name);
    const runs = [];
    for (const [esal, speed, consider] of [[115.6, 100, false], [20, 100, true], [0.1, 10, false], [5, 50, false]]) {
      const inputs = { latitude: parsed.station.latitude ?? 9.23, designEsalMillions: esal, designSpeedKmh: speed, acceptConsiderBump: consider };
      try {
        const { climate, grade } = analyse(parsed.observations, inputs);
        runs.push({ climate, grade });
      } catch (e) {
        runs.push({ error: e.message });
      }
    }
    results[name] = { parsed, runs };
  } catch (e) {
    results[name] = { error: e.message };
  }
}
fs.writeFileSync(path.join(__dirname, 'ts_results.json'), JSON.stringify(results));
console.log('TypeScript results for', Object.keys(results).length, 'files');
