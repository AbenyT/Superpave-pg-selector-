/**
 * A problem with the user's data or inputs. `message` is one short,
 * plain-language sentence that the page can show as it is.
 */
export type AnalysisErrorCode =
  | 'BAD_FILE'
  | 'NO_DATA'
  | 'TOO_FEW_YEARS_HIGH'
  | 'TOO_FEW_YEARS_LOW'
  | 'INVALID_INPUT';

export class AnalysisError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}
