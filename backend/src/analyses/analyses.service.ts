import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { analyseClimate, computeGrade, DesignInputs, ENGINE_VERSION } from '@pg/engine';
import { readTemperatureFile } from '@pg/parser';
import { CreateAnalysisDto, UpdateAnalysisDto } from './analysis.dto';
import { AnalysesRepository, AnalysisRecord } from './analysis.repository';

export interface UploadedTemperatureFile {
  originalname: string;
  buffer: Buffer;
}

/**
 * What the page receives. The data-quality report (invalid dates, gaps, filled
 * days, …) stays in the database and is not sent: the page never shows it.
 */
export function toView(record: AnalysisRecord) {
  const { quality: _quality, ...climate } = record.climate;
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    engineVersion: record.engineVersion,
    projectName: record.projectName,
    stationName: record.stationName,
    inputs: record.inputs,
    file: { name: record.fileName },
    station: record.station,
    climate,
    result: record.result,
  };
}

export type AnalysisView = ReturnType<typeof toView>;

@Injectable()
export class AnalysesService {
  constructor(private readonly repository: AnalysesRepository) {}

  /** Re-reads and re-checks the uploaded file on the server, runs the engine and saves the analysis. */
  async create(file: UploadedTemperatureFile | undefined, dto: CreateAnalysisDto): Promise<AnalysisView> {
    if (!file || file.buffer.length === 0) {
      throw new BadRequestException({ message: 'Upload a temperature file (CSV or Excel).', code: 'NO_FILE' });
    }
    const parsed = readTemperatureFile(new Uint8Array(file.buffer), file.originalname);
    const latitude = dto.latitude ?? parsed.station.latitude;
    if (latitude === null || latitude === undefined) {
      throw new BadRequestException({ message: 'Enter the latitude of the station.', code: 'INVALID_INPUT' });
    }
    const inputs: Required<DesignInputs> = {
      latitude,
      designEsalMillions: dto.designEsalMillions,
      designSpeedKmh: dto.designSpeedKmh,
      acceptConsiderBump: dto.acceptConsiderBump ?? false,
    };
    const climate = analyseClimate(parsed.observations);
    const result = computeGrade(climate, inputs);
    const record = await this.repository.create({
      projectName: dto.projectName,
      stationName: dto.stationName || parsed.station.name,
      inputs,
      fileName: file.originalname.slice(0, 255),
      fileSha256: createHash('sha256').update(file.buffer).digest('hex'),
      station: parsed.station,
      climate,
      result,
      engineVersion: ENGINE_VERSION,
    });
    return toView(record);
  }

  async get(id: string): Promise<AnalysisView> {
    return toView(await this.find(id));
  }

  /** Changes inputs of a saved analysis and recalculates the grade from its saved yearly results. */
  async update(id: string, dto: UpdateAnalysisDto): Promise<AnalysisView> {
    const record = await this.find(id);
    const inputs: Required<DesignInputs> = {
      latitude: dto.latitude ?? record.inputs.latitude,
      designEsalMillions: dto.designEsalMillions ?? record.inputs.designEsalMillions,
      designSpeedKmh: dto.designSpeedKmh ?? record.inputs.designSpeedKmh,
      acceptConsiderBump: dto.acceptConsiderBump ?? record.inputs.acceptConsiderBump,
    };
    const updated = await this.repository.update(id, {
      projectName: dto.projectName ?? record.projectName,
      stationName: dto.stationName !== undefined ? dto.stationName || null : record.stationName,
      inputs,
      result: computeGrade(record.climate, inputs),
      engineVersion: ENGINE_VERSION,
    });
    return toView(updated);
  }

  private async find(id: string): Promise<AnalysisRecord> {
    const record = await this.repository.findById(id);
    if (!record) throw new NotFoundException({ message: 'This analysis was not found.', code: 'NOT_FOUND' });
    return record;
  }
}
