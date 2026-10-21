import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto } from './auth.dto';
import { UserRecord, UsersRepository } from './users.repository';

export interface PublicUser { id: string; email: string; name: string | null }
export interface AuthResponse { accessToken: string; user: PublicUser }

/** Accounts work as in the AASHTO 1993 app: email + password (bcrypt), and a JWT the page keeps. */
@Injectable()
export class AuthService {
  constructor(private readonly users: UsersRepository, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException({ message: 'An account with this email already exists. Log in instead.', code: 'EMAIL_TAKEN' });
    }
    const user = await this.users.create({
      email: dto.email,
      name: dto.name || null,
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    // Same message whether the email or the password is wrong, so emails cannot be probed.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({ message: 'Wrong email or password.', code: 'WRONG_LOGIN' });
    }
    return this.issueToken(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException({ message: 'Please log in again.', code: 'SIGNED_OUT' });
    return publicUser(user);
  }

  private async issueToken(user: UserRecord): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { accessToken, user: publicUser(user) };
  }
}

function publicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}
