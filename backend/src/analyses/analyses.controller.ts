import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MAX_FILE_BYTES } from '@pg/parser';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CreateAnalysisDto, UpdateAnalysisDto } from './analysis.dto';
import { AnalysesService, AnalysisView, UploadedTemperatureFile } from './analyses.service';
import { AnalysisSummary } from './analysis.repository';

const analysisId = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException({ message: 'This analysis was not found.', code: 'NOT_FOUND' }),
});

/**
 * POST   /analyses       (signed in) multipart form: file + projectName, stationName?, latitude?,
 *                        designEsalMillions, designSpeedKmh, acceptConsiderBump?  → the saved analysis
 * GET    /analyses       (signed in) → my analyses, newest first
 * GET    /analyses/:id   → a saved analysis (anyone with the link)
 * PATCH  /analyses/:id   (owner) JSON with any of the fields above (no file) → recalculated and saved
 * DELETE /analyses/:id   (owner)
 */
@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analyses: AnalysesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 20 } }))
  create(
    @UploadedFile() file: UploadedTemperatureFile | undefined,
    @Body() dto: CreateAnalysisDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AnalysisView> {
    return this.analyses.create(file, dto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser): Promise<AnalysisSummary[]> {
    return this.analyses.list(user.id);
  }

  @Get(':id')
  get(@Param('id', analysisId) id: string): Promise<AnalysisView> {
    return this.analyses.get(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', analysisId) id: string, @Body() dto: UpdateAnalysisDto, @CurrentUser() user: AuthUser): Promise<AnalysisView> {
    return this.analyses.update(id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@Param('id', analysisId) id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.analyses.remove(id, user.id);
  }
}
