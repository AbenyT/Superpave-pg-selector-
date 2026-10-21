import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ENGINE_VERSION } from '@pg/engine';
import { AnalysesRepository } from './analyses/analysis.repository';

/**
 * GET /health — Render's health check, and the page's "wake up" call when it opens.
 * Always 200 while the server runs; "storage" says where analyses are saved and whether it is reachable.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly repository: AnalysesRepository) {}

  @Get()
  async health() {
    return {
      status: 'ok',
      storage: this.repository.kind,
      database: this.repository.kind === 'database' ? await this.repository.ping() : 'not used',
      engineVersion: ENGINE_VERSION,
      time: new Date().toISOString(),
    };
  }
}
