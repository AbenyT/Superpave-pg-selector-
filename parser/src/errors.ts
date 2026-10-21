import { AnalysisError } from '@pg/engine';

/** A problem with the uploaded file, as one plain sentence for the page. */
export function fileError(message: string): AnalysisError {
  return new AnalysisError('BAD_FILE', message);
}
