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
}

export type NewAnalysis = Omit<AnalysisRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type AnalysisChanges = Pick<NewAnalysis, 'projectName' | 'stationName' | 'inputs' | 'result' | 'engineVersion'>;

/** Where analyses are saved: PostgreSQL (Supabase) in production, memory when no database is set. */
export abstract class AnalysesRepository {
  abstract readonly kind: 'database' | 'memory';
  abstract create(data: NewAnalysis): Promise<AnalysisRecord>;
  abstract findById(id: string): Promise<AnalysisRecord | null>;
  abstract update(id: string, changes: AnalysisChanges): Promise<AnalysisRecord>;
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

  async ping(): Promise<'up'> {
    return 'up';
  }
}
