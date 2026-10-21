/** The "Download template" files. */

import * as XLSX from 'xlsx';

const DAY_HEADERS = Array.from({ length: 31 }, (_, i) => i + 1);

// Example values only (one January), to show where numbers go.
const EXAMPLE_TMAX = [
  27, 28, 31.2, 29.2, 30.2, 30.2, 28.2, 28, 27.5, 28.4, 28.8, 27.5, 28.8, 27.8, 27.5, 30.5, 29.6, 29.7, 32.6, 30, 29.2,
  32, 31, 31, 29.5, 29, 29.5, 30.5, 33.8, 28.5, 27.5,
];
const EXAMPLE_TMIN = EXAMPLE_TMAX.map((v) => Math.round((v - 15.5) * 10) / 10);

const INSTRUCTIONS = [
  ['Superpave PG Binder Selector: temperature data template'],
  [],
  ['Fill the sheet "Data": one row per station, element, year and month.'],
  ['Name: station name.  Latitude: degrees (north positive).'],
  ['element: TMPMAX for daily maximum, TMPMIN for daily minimum temperature (°C).'],
  ['Year, Month: numbers, e.g. 2005 and 1.  Columns 1 … 31: the value of each day.'],
  ['Leave a cell empty (or write X) when there is no reading.'],
  [],
  ['Other layouts are also read automatically, for example:'],
  ['  Date | Tmax | Tmin               (one row per day)'],
  ['  Year | Month | Day | Tmax | Tmin'],
  ['  Date | Element | Value'],
  ['  Year | Day | Jan … Dec           (one sheet for Tmax, one for Tmin)'],
  [],
  ['Use at least 5 years (10 or more is better). A year is used only if 75% of its days have readings.'],
];

/** Excel template with a "Data" sheet in the station layout and an "Instructions" sheet. */
export function templateWorkbook(): Uint8Array {
  const data = [
    ['Name', 'Latitude', 'element', 'Year', 'Month', ...DAY_HEADERS],
    ['My Station', 9.23, 'TMPMAX', 2024, 1, ...EXAMPLE_TMAX],
    ['My Station', 9.23, 'TMPMIN', 2024, 1, ...EXAMPLE_TMIN],
  ];
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 6 }, { wch: 6 }, ...DAY_HEADERS.map(() => ({ wch: 5 }))];
  XLSX.utils.book_append_sheet(wb, sheet, 'Data');
  const help = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  help['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, help, 'Instructions');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** CSV template in the simple daily layout: Date, Tmax, Tmin. */
export function templateCsvDaily(): string {
  const lines = ['Date,Tmax,Tmin'];
  EXAMPLE_TMAX.slice(0, 5).forEach((v, i) => lines.push(`2024-01-${String(i + 1).padStart(2, '0')},${v},${EXAMPLE_TMIN[i]}`));
  return lines.join('\r\n') + '\r\n';
}
