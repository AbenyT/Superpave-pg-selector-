import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorsFilter } from './errors.filter';

/**
 * Turns CORS_ORIGINS ("https://app.vercel.app,https://app-*.vercel.app,http://localhost:3000")
 * into a check function. "*" matches any characters, so Vercel preview URLs can be allowed.
 */
export function corsOriginChecker(setting = process.env.CORS_ORIGINS ?? 'http://localhost:3000') {
  const patterns = setting
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map((p) => new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$'));
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No Origin header = not a browser cross-site request (curl, Render health check): allow.
    if (!origin) return callback(null, true);
    callback(null, patterns.some((p) => p.test(origin)));
  };
}

function firstMessage(errors: ValidationError[]): string {
  for (const e of errors) {
    const message = e.constraints ? Object.values(e.constraints)[0] : undefined;
    if (message) return message.startsWith('property ') ? `Unknown field "${e.property}".` : message;
    if (e.children?.length) return firstMessage(e.children);
  }
  return 'Some inputs are not valid.';
}

/** Settings shared by the real server (main.ts) and the API tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.enableCors({ origin: corsOriginChecker(), credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException({ message: firstMessage(errors), code: 'INVALID_INPUT' }),
    }),
  );
  app.useGlobalFilters(new ErrorsFilter());
  app.enableShutdownHooks();
  return app;
}
