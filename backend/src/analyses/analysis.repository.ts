import { randomUUID } from 'crypto';
import { ClimateAnalysis, DesignInputs, GradeResult } from '@pg/engine';
import { StationInfo } from '@pg/parser';

/** A saved analysis as the rest of the app sees it. */
export interface AnalysisRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  projectName: string;
  stationName: string | null;
  inputs: Required<DesignInputs>;
  fileName: string;
  fileSha256: string;
  station: StationInfo;
  climate: ClimateAnalysis;
  result: GradeResult;
  engineVersion: string;
  /** The account that made it; null for analyses saved before accounts existed. */
  ownerId: string | null;
}

/** One line of the "My analyses" list (no yearly data, so the list stays small). */
export interface AnalysisSummary {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  projectName: string;
  stationName: string | null;
  latitude: number;
  designEsalMillions: number;
  designSpeedKmh: number;
  climateGrade: string;
  finalGrade: string;
  binderType: string;
}

export function summaryOf(record: AnalysisRecord): AnalysisSummary {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    projectName: record.projectName,
    stationName: record.stationName,
    latitude: record.inputs.latitude,
    designEsalMillions: record.inputs.designEsalMillions,
    designSpeedKmh: record.inputs.designSpeedKmh,
    climateGrade: record.result.climateGrade.label,
    finalGrade: record.result.finalGrade.label,
    binderType: record.result.binderType.name,
  };
}

export type NewAnalysis = Omit<AnalysisRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type AnalysisChanges = Pick<NewAnalysis, 'projectName' | 'stationName' | 'inputs' | 'result' | 'engineVersion'>;

/** Where analyses are saved: PostgreSQL (Supabase) in production, memory when no database is set. */
export abstract class AnalysesRepository {
  abstract readonly kind: 'database' | 'memory';
  abstract create(data: NewAnalysis): Promise<AnalysisRecord>;
  abstract findById(id: string): Promise<AnalysisRecord | null>;
  abstract update(id: string, changes: AnalysisChanges): Promise<AnalysisRecord>;
  /** The owner's analyses, newest change first. */
  abstract listByOwner(ownerId: string): Promise<AnalysisSummary[]>;
  abstract delete(id: string): Promise<void>;
  /** 'up' / 'down' for the database; always 'up' for memory. */
  abstract ping(): Promise<'up' | 'down'>;
}

/** Keeps analyses in memory (lost on restart). Used for local trials and tests without a database. */
export class MemoryAnalysesRepository extends AnalysesRepository {
  readonly kind = 'memory' as const;
  private readonly items = new Map<string, AnalysisRecord>();

  async create(data: NewAnalysis): Promise<AnalysisRecord> {
    const now = new Date();
    const record: AnalysisRecord = { ...structuredClone(data), id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(record.id, record);
    return structuredClone(record);
  }

  async findById(id: string): Promise<AnalysisRecord | null> {
    const record = this.items.get(id);
    return record ? structuredClone(record) : null;
  }

  async update(id: string, changes: AnalysisChanges): Promise<AnalysisRecord> {
    const record = this.items.get(id);
    if (!record) throw new Error(`Analysis ${id} not found`);
    const updated = { ...record, ...structuredClone(changes), updatedAt: new Date() };
    this.items.set(id, updated);
    return structuredClone(updated);
  }

  async listByOwner(ownerId: string): Promise<AnalysisSummary[]> {
    return [...this.items.values()]
      .filter((r) => r.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(summaryOf);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async ping(): Promise<'up'> {
    return 'up';
  }
}
