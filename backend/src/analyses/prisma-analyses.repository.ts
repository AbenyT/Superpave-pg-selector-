import { OnModuleDestroy } from '@nestjs/common';
import { Analysis, Prisma, PrismaClient } from '@prisma/client';
import { ClimateAnalysis, GradeResult } from '@pg/engine';
import { StationInfo } from '@pg/parser';
import { AnalysesRepository, AnalysisChanges, AnalysisRecord, NewAnalysis } from './analysis.repository';

const json = (value: unknown) => value as Prisma.InputJsonValue;

function toRecord(row: Analysis): AnalysisRecord {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    projectName: row.projectName,
    stationName: row.stationName,
    inputs: {
      latitude: row.latitude,
      designEsalMillions: row.designEsalMillions,
      designSpeedKmh: row.designSpeedKmh,
      acceptConsiderBump: row.acceptConsiderBump,
    },
    fileName: row.fileName,
    fileSha256: row.fileSha256,
    station: row.station as unknown as StationInfo,
    climate: row.climate as unknown as ClimateAnalysis,
    result: row.result as unknown as GradeResult,
    engineVersion: row.engineVersion,
  };
}

function summaryColumns(data: Pick<NewAnalysis, 'inputs' | 'result'>) {
  return {
    latitude: data.inputs.latitude,
    designEsalMillions: data.inputs.designEsalMillions,
    designSpeedKmh: data.inputs.designSpeedKmh,
    acceptConsiderBump: data.inputs.acceptConsiderBump,
    reliabilityPercent: data.result.reliabilityPercent,
    climateGrade: data.result.climateGrade.label,
    finalGrade: data.result.finalGrade.label,
    result: json(data.result),
  };
}

/** Saves analyses in PostgreSQL (Supabase) through Prisma. */
export class PrismaAnalysesRepository extends AnalysesRepository implements OnModuleDestroy {
  readonly kind = 'database' as const;

  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async create(data: NewAnalysis): Promise<AnalysisRecord> {
    const row = await this.prisma.analysis.create({
      data: {
        ...summaryColumns(data),
        projectName: data.projectName,
        stationName: data.stationName,
        fileName: data.fileName,
        fileSha256: data.fileSha256,
        station: json(data.station),
        climate: json(data.climate),
        engineVersion: data.engineVersion,
      },
    });
    return toRecord(row);
  }

  async findById(id: string): Promise<AnalysisRecord | null> {
    const row = await this.prisma.analysis.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async update(id: string, changes: AnalysisChanges): Promise<AnalysisRecord> {
    const row = await this.prisma.analysis.update({
      where: { id },
      data: {
        ...summaryColumns(changes),
        projectName: changes.projectName,
        stationName: changes.stationName,
        engineVersion: changes.engineVersion,
      },
    });
    return toRecord(row);
  }

  async ping(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
