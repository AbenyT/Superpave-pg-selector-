import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /auth/register body. */
export class RegisterDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(200, { message: 'The email address is too long.' })
  email!: string;

  @IsString({ message: 'Enter a password.' })
  @MinLength(8, { message: 'The password must be at least 8 characters.' })
  @MaxLength(72, { message: 'The password is too long (72 characters at most).' }) // bcrypt only uses the first 72 bytes
  password!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Name must be text.' })
  @MaxLength(100, { message: 'Name is too long (100 characters at most).' })
  name?: string;
}

/** POST /auth/login body. */
export class LoginDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString({ message: 'Enter your password.' })
  @MinLength(1, { message: 'Enter your password.' })
  password!: string;
}
