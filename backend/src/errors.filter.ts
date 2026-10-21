import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { AnalysisError } from '@pg/engine';

/** Every error reply has the same shape: { message: "one plain sentence", code }. */
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.describe(error);
    if (status >= 500) this.logger.error(error instanceof Error ? error.stack : String(error));
    res.status(status).json(body);
  }

  private describe(error: unknown): [number, { message: string; code: string }] {
    if (error instanceof AnalysisError) {
      // The file or the data is the problem, not the request format.
      return [HttpStatus.UNPROCESSABLE_ENTITY, { message: error.message, code: error.code }];
    }
    if (error instanceof PayloadTooLargeException) {
      return [413, { message: 'The file is larger than 10 MB. Upload one station at a time.', code: 'BAD_FILE' }];
    }
    if (error instanceof ThrottlerException) {
      return [429, { message: 'Too many requests. Please wait a minute and try again.', code: 'TOO_MANY_REQUESTS' }];
    }
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();
      let message = error.message;
      let code = status === 404 ? 'NOT_FOUND' : 'INVALID_INPUT';
      if (typeof response === 'object' && response !== null) {
        const r = response as { message?: unknown; code?: unknown };
        if (Array.isArray(r.message)) message = String(r.message[0]);
        else if (typeof r.message === 'string') message = r.message;
        if (typeof r.code === 'string') code = r.code;
      }
      if (status === 404 && code === 'NOT_FOUND' && message.startsWith('Cannot ')) message = 'Not found.';
      return [status, { message, code }];
    }
    return [500, { message: 'Something went wrong on the server. Please try again.', code: 'SERVER_ERROR' }];
  }
}
