import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser { id: string; email: string }

async function readUser(jwt: JwtService, header: unknown): Promise<AuthUser | null> {
  const [scheme, token] = String(header ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = await jwt.verifyAsync<{ sub: string; email: string }>(token);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Protects a route: requires "Authorization: Bearer <token>" from /auth/login or /auth/register,
 * and puts the signed-in user on request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await readUser(this.jwt, request.headers.authorization);
    if (!user) {
      const hasToken = String(request.headers.authorization ?? '').startsWith('Bearer ');
      throw new UnauthorizedException({
        message: hasToken ? 'Your session has expired. Please log in again.' : 'Please log in first.',
        code: 'SIGNED_OUT',
      });
    }
    request.user = user;
    return true;
  }
}

/** Use in a controller method: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest().user,
);
