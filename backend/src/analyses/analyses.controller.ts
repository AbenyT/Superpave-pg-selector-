import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MAX_FILE_BYTES } from '@pg/parser';
import { CreateAnalysisDto, UpdateAnalysisDto } from './analysis.dto';
import { AnalysesService, AnalysisView, UploadedTemperatureFile } from './analyses.service';

const analysisId = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException({ message: 'This analysis was not found.', code: 'NOT_FOUND' }),
});

/**
 * POST  /analyses       multipart form: file + projectName, stationName?, latitude?, designEsalMillions,
 *                       designSpeedKmh, acceptConsiderBump?  → the saved analysis
 * GET   /analyses/:id   → a saved analysis (to reopen it)
 * PATCH /analyses/:id   JSON with any of the fields above (no file) → recalculated and saved
 */
@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analyses: AnalysesService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 20 } }))
  create(@UploadedFile() file: UploadedTemperatureFile | undefined, @Body() dto: CreateAnalysisDto): Promise<AnalysisView> {
    return this.analyses.create(file, dto);
  }

  @Get(':id')
  get(@Param('id', analysisId) id: string): Promise<AnalysisView> {
    return this.analyses.get(id);
  }

  @Patch(':id')
  update(@Param('id', analysisId) id: string, @Body() dto: UpdateAnalysisDto): Promise<AnalysisView> {
    return this.analyses.update(id, dto);
  }
}
