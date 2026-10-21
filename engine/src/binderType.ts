import { BINDER_MATRIX, BINDER_MATRIX_LOW, BINDER_TYPES, RULE_OF_90, type BinderTypeCode } from './config/binderType';

export interface BinderType {
  code: BinderTypeCode;
  name: string;
  description: string;
  /** False when the grade is outside the chart and the fallback rule was used. */
  fromChart: boolean;
  /** high + |low| (the "rule of 90"). */
  temperatureSum: number;
  /** True when temperatureSum > 90: the rule of thumb says "likely polymer-modified". */
  ruleOf90SaysModified: boolean;
}

export function binderType(highGrade: number, lowGrade: number): BinderType {
  const row = BINDER_MATRIX[highGrade];
  const i = (BINDER_MATRIX_LOW as readonly number[]).indexOf(lowGrade);
  let code: BinderTypeCode;
  let fromChart = true;
  if (row && i !== -1) {
    code = row[i];
  } else {
    fromChart = false;
    code = highGrade >= 82 || lowGrade <= -34 ? 3 : highGrade >= 70 || lowGrade <= -28 ? 2 : 1;
  }
  const temperatureSum = highGrade + Math.abs(lowGrade);
  return { code, ...BINDER_TYPES[code], fromChart, temperatureSum, ruleOf90SaysModified: temperatureSum > RULE_OF_90 };
}
