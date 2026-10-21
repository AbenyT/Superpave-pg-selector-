/** Recognises what a column holds from its name, in the many ways stations and people write it. */

import { Element } from '@pg/engine';
import { Cell, cellText, mentionsFahrenheit, textKey } from './values';

export type Role =
  | 'station'
  | 'latitude'
  | 'longitude'
  | 'elevation'
  | 'element'
  | 'year'
  | 'month'
  | 'day'
  | 'date'
  | 'tmax'
  | 'tmin'
  | 'value';

const ROLE_NAMES: Record<Exclude<Role, 'tmax' | 'tmin'>, string[]> = {
  station: ['name', 'station', 'stationname', 'stn', 'stnname', 'site', 'sitename', 'stationid', 'location'],
  latitude: ['lat', 'latitude', 'lati', 'latdeg', 'geogr2'],
  longitude: ['lon', 'long', 'longitude', 'lng', 'longdeg', 'geogr1'],
  elevation: ['elevation', 'elev', 'alt', 'altitude', 'height', 'elevationm'],
  element: ['element', 'elem', 'elementcode', 'elementname', 'variable', 'var', 'parameter', 'param', 'measurement', 'type'],
  year: ['year', 'yr', 'yyyy', 'years', 'yy'],
  month: ['month', 'mon', 'mm', 'mo', 'months', 'mth'],
  day: ['day', 'dd', 'dy', 'dayofmonth'],
  date: ['date', 'dates', 'datetime', 'obsdate', 'observationdate', 'timestamp', 'dateyyyymmdd', 'ddmmyyyy', 'yyyymmdd', 'dailydate'],
  value: ['value', 'values', 'val', 'temperature', 'temp', 'reading', 'obs', 'observation', 'data', 'amount'],
};

const ELEMENT_NAMES: Record<Element, string[]> = {
  tmax: [
    'tmax', 'tmpmax', 'tempmax', 'maxtemp', 'maxtemperature', 'maximumtemperature', 'maximumtemp', 'maxtmp', 'tx',
    'max', 'maximum', 'tmaximum', 'airtempmax', 'temperaturemax', 'high', 'hightemp', 'dailymax', 'dailymaximum',
    'maxairtemperature', 'maximumairtemperature', 'tmx',
  ],
  tmin: [
    'tmin', 'tmpmin', 'tempmin', 'mintemp', 'mintemperature', 'minimumtemperature', 'minimumtemp', 'mintmp', 'tn',
    'min', 'minimum', 'tminimum', 'airtempmin', 'temperaturemin', 'low', 'lowtemp', 'dailymin', 'dailyminimum',
    'minairtemperature', 'minimumairtemperature', 'tmn',
  ],
};

const MONTH_NAMES = [
  ['jan', 'january'],
  ['feb', 'february'],
  ['mar', 'march'],
  ['apr', 'april'],
  ['may'],
  ['jun', 'june'],
  ['jul', 'july'],
  ['aug', 'august'],
  ['sep', 'sept', 'september'],
  ['oct', 'october'],
  ['nov', 'november'],
  ['dec', 'december'],
];

/** 1–12 for a month name ("Jan", "january", "Sept"), else null. */
export function monthFromName(text: string): number | null {
  const key = textKey(text);
  const i = MONTH_NAMES.findIndex((names) => names.includes(key));
  return i === -1 ? null : i + 1;
}

/**
 * 'tmax' / 'tmin' for an element code, column name, sheet name or title
 * ("TMPMAX", "Tmax (°C)", "Daily Maximum Temperature", "TN"), else null.
 */
export function elementFromText(text: string): Element | null {
  const key = textKey(text);
  if (!key) return null;
  if (ELEMENT_NAMES.tmax.includes(key)) return 'tmax';
  if (ELEMENT_NAMES.tmin.includes(key)) return 'tmin';
  if (key.includes('minute')) return null;
  const temperatureWord = key.includes('temp') || key.includes('tmp') || key.startsWith('t');
  const isMax = key.includes('max');
  const isMin = key.includes('min');
  if (temperatureWord && isMax && !isMin) return 'tmax';
  if (temperatureWord && isMin && !isMax) return 'tmin';
  return null;
}

/** Like elementFromText, but also tries each word of a name such as "station_tmax" or "Meisso TN 2024". */
export function elementFromName(text: string): Element | null {
  const whole = elementFromText(text);
  if (whole) return whole;
  for (const word of text.split(/[^A-Za-z0-9]+/)) {
    const e = elementFromText(word);
    if (e) return e;
  }
  return null;
}

export interface HeaderInfo {
  role?: Role;
  /** A daily column "1" … "31" (also "Day 1", "D01", "1st"). */
  dayOfMonth?: number;
  /** A monthly column "Jan" … "Dec". */
  monthOfYear?: number;
  fahrenheit: boolean;
}

export function classifyHeader(cell: Cell): HeaderInfo {
  if (typeof cell === 'number') {
    return Number.isInteger(cell) && cell >= 1 && cell <= 31 ? { dayOfMonth: cell, fahrenheit: false } : { fahrenheit: false };
  }
  const text = cellText(cell);
  const fahrenheit = mentionsFahrenheit(text);
  const key = textKey(text);
  if (!key) return { fahrenheit };
  for (const [role, names] of Object.entries(ROLE_NAMES) as [Role, string[]][]) {
    if (names.includes(key)) return { role, fahrenheit };
  }
  const day = /^(?:day|d)?0?([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?$/.exec(key);
  if (day) return { dayOfMonth: Number(day[1]), fahrenheit };
  const month = monthFromName(text);
  if (month !== null) return { monthOfYear: month, fahrenheit };
  const element = elementFromText(text);
  if (element) return { role: element, fahrenheit };
  return { fahrenheit };
}
