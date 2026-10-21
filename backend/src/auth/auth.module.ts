import { createHash, randomBytes } from 'crypto';
import { Global, Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { usesDatabase } from '../storage';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MemoryUsersRepository, PrismaUsersRepository, UsersRepository } from './users.repository';

/**
 * The key that signs log-in tokens. JWT_SECRET is used when set (Render generates one from render.yaml).
 * Without it, a key is derived from DATABASE_URL (secret, and the same after every restart), or, with no
 * database either, a random key is made (fine on a PC: log-ins then end when the server restarts).
 */
function jwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    if (configured.length < 16) throw new Error('JWT_SECRET is too short (use at least 16 random characters).');
    return configured;
  }
  const logger = new Logger('Auth');
  if (process.env.DATABASE_URL) {
    logger.warn('JWT_SECRET is not set: using a key derived from DATABASE_URL.');
    return createHash('sha256').update(`superpave-pg-selector jwt\n${process.env.DATABASE_URL}`).digest('hex');
  }
  logger.warn('JWT_SECRET is not set: using a random key, so log-ins end when the server restarts.');
  return randomBytes(32).toString('hex');
}

/** @Global so the analyses module can use the guard (it needs JwtService). */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    {
      provide: UsersRepository,
      useFactory: (): UsersRepository => (usesDatabase() ? new PrismaUsersRepository() : new MemoryUsersRepository()),
    },
  ],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
