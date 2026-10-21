/**
 * The two public steps:
 *
 *   analyseClimate(observations)   → yearly 7-day maxima and yearly minima
 *                                    (independent of traffic)
 *   computeGrade(climate, inputs)  → design temperatures (98 % reliability),
 *                                    PG grade, bumping, spec table
 *
 * The page calls computeGrade again when the "consider +1 grade" toggle changes,
 * so no re-upload is needed.
 */

import { binderType, BinderType } from './binderType';
import { cleanObservations, DailySeries, Observation, QualityReport, yearCoverage } from './clean';
import { gradeLabel } from './config/grades';
import {
  highTemperatureDesign,
  lowTemperatureDesign,
  RELIABILITY_PERCENT,
  roundHighGrade,
  roundLowGrade,
  Z_98,
} from './design';
import { AnalysisError } from './errors';
import { AnnualMin, annualMinForYear, MonthlyCell, monthlyMeans, SevenDayMax, sevenDayMaxForYear } from './extremes';
import { DesignInputs, validateDesignInputs } from './inputs';
import { specificationTable, SpecTable } from './spec';
import { mean, sampleStandardDeviation } from './stats';
import { adjustForTraffic, TrafficAdjustment } from './traffic';
import { ENGINE_VERSION } from './version';

/** A year is used only if at least this share of its days were measured. */
export const MIN_REAL_FRACTION = 0.75;

/** Fewest usable years accepted for each of Tmax and Tmin. */
export const MIN_YEARS = 5;

/** A year in the file that is not used for design, and why (shown greyed out in the tables). */
export interface ExcludedYear {
  year: number;
  /** Share of the year's days with a measured value (0–1). */
  realFraction: number;
  /** 'too-few-days': below MIN_REAL_FRACTION; 'no-usable-period': enough days, but no complete 7-day window / usable day. */
  reason: 'too-few-days' | 'no-usable-period';
}

export interface YearSet<T> {
  years: T[];
  excludedYears: number[];
  excluded: ExcludedYear[];
}

export interface ClimateAnalysis {
  engineVersion: string;
  high: YearSet<SevenDayMax>;
  low: YearSet<AnnualMin>;
  /** Monthly means for the heatmaps (all years in the file, including left-out years). */
  monthly: { tmax: MonthlyCell[]; tmin: MonthlyCell[] };
  quality: QualityReport;
}

function collectYears<T>(series: DailySeries, pick: (s: DailySeries, year: number) => T | null): YearSet<T> {
  const set: YearSet<T> = { years: [], excludedYears: [], excluded: [] };
  for (const c of yearCoverage(series)) {
    const enoughDays = c.realFraction >= MIN_REAL_FRACTION;
    const result = enoughDays ? pick(series, c.year) : null;
    if (result !== null) {
      set.years.push(result);
      continue;
    }
    set.excludedYears.push(c.year);
    set.excluded.push({
      year: c.year,
      realFraction: c.realFraction,
      reason: enoughDays ? 'no-usable-period' : 'too-few-days',
    });
  }
  return set;
}

function tooFewYearsMessage(found: number, name: string): string {
  const what = found === 0 ? 'No year has' : found === 1 ? 'Only 1 year has' : `Only ${found} years have`;
  return (
    `${what} enough ${name} data. At least ${MIN_YEARS} years with ` +
    `${Math.round(MIN_REAL_FRACTION * 100)}% of days recorded are needed.`
  );
}

export function analyseClimate(observations: readonly Observation[]): ClimateAnalysis {
  const { series, quality } = cleanObservations(observations);
  if (series.tmax.values.length === 0 && series.tmin.values.length === 0) {
    throw new AnalysisError('NO_DATA', 'The file has no temperature values. Check the columns and try again.');
  }
  const high = collectYears(series.tmax, sevenDayMaxForYear);
  const low = collectYears(series.tmin, annualMinForYear);
  if (high.years.length < MIN_YEARS) {
    throw new AnalysisError('TOO_FEW_YEARS_HIGH', tooFewYearsMessage(high.years.length, 'maximum temperature (Tmax)'));
  }
  if (low.years.length < MIN_YEARS) {
    throw new AnalysisError('TOO_FEW_YEARS_LOW', tooFewYearsMessage(low.years.length, 'minimum temperature (Tmin)'));
  }
  const monthly = { tmax: monthlyMeans(series.tmax), tmin: monthlyMeans(series.tmin) };
  return { engineVersion: ENGINE_VERSION, high, low, monthly, quality };
}

export interface GradeResult {
  engineVersion: string;
  reliabilityPercent: number;
  z: number;
  high: {
    yearsUsed: number;
    mean: number;
    sd: number;
    designAirTemp: number;
    pavementTemp: number;
    grade: number;
    outOfRange: boolean;
    hottestYear: number;
  };
  low: {
    yearsUsed: number;
    mean: number;
    sd: number;
    meanAirTemp: number;
    designAirTemp: number;
    baseTemp: number;
    reliabilityTerm: number;
    pavementTemp: number;
    grade: number;
    outOfRange: boolean;
    coldestYear: number;
  };
  climateGrade: { high: number; low: number; label: string };
  traffic: TrafficAdjustment;
  finalGrade: { high: number; low: number; label: string };
  /** Crude oil / high-quality crude oil / modifier required, for the final grade. */
  binderType: BinderType;
  spec: SpecTable;
}

export function computeGrade(
  climate: Pick<ClimateAnalysis, 'high' | 'low'>,
  inputs: DesignInputs,
): GradeResult {
  const problems = validateDesignInputs(inputs);
  if (problems.length > 0) throw new AnalysisError('INVALID_INPUT', problems[0].message);

  const highValues = climate.high.years.map((y) => y.average);
  const highMean = mean(highValues);
  const highSd = sampleStandardDeviation(highValues);
  const high = highTemperatureDesign(highMean, highSd, inputs.latitude);
  const highGrade = roundHighGrade(high.pavementTemp20mm);
  const hottest = climate.high.years.reduce((a, b) => (b.average > a.average ? b : a));

  const lowValues = climate.low.years.map((y) => y.value);
  const lowMean = mean(lowValues);
  const lowSd = sampleStandardDeviation(lowValues);
  const low = lowTemperatureDesign(lowMean, lowSd, inputs.latitude);
  const lowGrade = roundLowGrade(low.pavementTemp);
  const coldest = climate.low.years.reduce((a, b) => (b.value < a.value ? b : a));

  const traffic = adjustForTraffic(
    highGrade.grade,
    inputs.designEsalMillions,
    inputs.designSpeedKmh,
    inputs.acceptConsiderBump ?? false,
  );

  return {
    engineVersion: ENGINE_VERSION,
    reliabilityPercent: RELIABILITY_PERCENT,
    z: Z_98,
    high: {
      yearsUsed: highValues.length,
      mean: highMean,
      sd: highSd,
      designAirTemp: high.designAirTemp,
      pavementTemp: high.pavementTemp20mm,
      grade: highGrade.grade,
      outOfRange: highGrade.outOfRange,
      hottestYear: hottest.year,
    },
    low: {
      yearsUsed: lowValues.length,
      mean: lowMean,
      sd: lowSd,
      meanAirTemp: low.meanAirTemp,
      designAirTemp: low.designAirTemp,
      baseTemp: low.baseTemp,
      reliabilityTerm: low.reliabilityTerm,
      pavementTemp: low.pavementTemp,
      grade: lowGrade.grade,
      outOfRange: lowGrade.outOfRange,
      coldestYear: coldest.year,
    },
    climateGrade: { high: highGrade.grade, low: lowGrade.grade, label: gradeLabel(highGrade.grade, lowGrade.grade) },
    traffic,
    finalGrade: {
      high: traffic.highGradeAfter,
      low: lowGrade.grade,
      label: gradeLabel(traffic.highGradeAfter, lowGrade.grade),
    },
    binderType: binderType(traffic.highGradeAfter, lowGrade.grade),
    spec: specificationTable(traffic.highGradeAfter, lowGrade.grade),
  };
}

/** Both steps in one call. */
export function analyse(
  observations: readonly Observation[],
  inputs: DesignInputs,
): { climate: ClimateAnalysis; grade: GradeResult } {
  const climate = analyseClimate(observations);
  return { climate, grade: computeGrade(climate, inputs) };
}
