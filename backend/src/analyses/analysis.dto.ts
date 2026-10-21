/**
 * Checks on the form fields. Messages are short sentences the page can show as they are.
 * Number fields also accept text such as "115,6" (multipart forms send text).
 */

import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { INPUT_LIMITS } from '@pg/engine';

function toNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const text = value.trim().replace(',', '.');
  return text === '' ? undefined : Number(text);
}

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === '1' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === '') return false;
  return value;
}

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

const L = INPUT_LIMITS;
const latitudeMessage = `Latitude must be a number from ${L.latitude.min} to ${L.latitude.max}°.`;
const esalMessage = `Design ESAL must be a number from ${L.designEsalMillions.min} to ${L.designEsalMillions.max} million.`;
const speedMessage = `Design speed must be a number from ${L.designSpeedKmh.min} to ${L.designSpeedKmh.max} km/h.`;

class EditableFields {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Station name must be text.' })
  @MaxLength(200, { message: 'Station name is too long (200 characters at most).' })
  stationName?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({}, { message: latitudeMessage })
  @Min(L.latitude.min, { message: latitudeMessage })
  @Max(L.latitude.max, { message: latitudeMessage })
  latitude?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'The "consider one grade" choice must be true or false.' })
  acceptConsiderBump?: boolean;
}

/** Fields sent with the uploaded file (POST /analyses). */
export class CreateAnalysisDto extends EditableFields {
  @Transform(trim)
  @IsString({ message: 'Enter a project name.' })
  @IsNotEmpty({ message: 'Enter a project name.' })
  @MaxLength(200, { message: 'Project name is too long (200 characters at most).' })
  projectName!: string;

  @Transform(toNumber)
  @IsNumber({}, { message: esalMessage })
  @Min(L.designEsalMillions.min, { message: esalMessage })
  @Max(L.designEsalMillions.max, { message: esalMessage })
  designEsalMillions!: number;

  @Transform(toNumber)
  @IsNumber({}, { message: speedMessage })
  @Min(L.designSpeedKmh.min, { message: speedMessage })
  @Max(L.designSpeedKmh.max, { message: speedMessage })
  designSpeedKmh!: number;
}

/** Changes to a saved analysis (PATCH /analyses/:id); the grade is recalculated without the file. */
export class UpdateAnalysisDto extends EditableFields {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter a project name.' })
  @IsNotEmpty({ message: 'Enter a project name.' })
  @MaxLength(200, { message: 'Project name is too long (200 characters at most).' })
  projectName?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({}, { message: esalMessage })
  @Min(L.designEsalMillions.min, { message: esalMessage })
  @Max(L.designEsalMillions.max, { message: esalMessage })
  designEsalMillions?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({}, { message: speedMessage })
  @Min(L.designSpeedKmh.min, { message: speedMessage })
  @Max(L.designSpeedKmh.max, { message: speedMessage })
  designSpeedKmh?: number;
}
