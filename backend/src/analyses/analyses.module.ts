import { Logger, Module } from '@nestjs/common';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';
import { AnalysesRepository, MemoryAnalysesRepository } from './analysis.repository';
import { PrismaAnalysesRepository } from './prisma-analyses.repository';

@Module({
  controllers: [AnalysesController],
  providers: [
    AnalysesService,
    {
      provide: AnalysesRepository,
      useFactory: (): AnalysesRepository => {
        if (process.env.DATABASE_URL) return new PrismaAnalysesRepository();
        new Logger('Storage').warn('DATABASE_URL is not set: analyses are kept in memory and lost on restart.');
        return new MemoryAnalysesRepository();
      },
    },
  ],
  exports: [AnalysesRepository],
})
export class AnalysesModule {}
