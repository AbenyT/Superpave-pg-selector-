import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sharedPrisma } from '../storage';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: Date;
}

export type NewUser = Pick<UserRecord, 'email' | 'passwordHash' | 'name'>;

/** Where accounts are saved: PostgreSQL in production, memory when no database is set (same rule as analyses). */
export abstract class UsersRepository {
  abstract create(data: NewUser): Promise<UserRecord>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract findById(id: string): Promise<UserRecord | null>;
}

export class MemoryUsersRepository extends UsersRepository {
  private readonly items = new Map<string, UserRecord>();

  async create(data: NewUser): Promise<UserRecord> {
    const record: UserRecord = { ...data, id: randomUUID(), createdAt: new Date() };
    this.items.set(record.id, record);
    return { ...record };
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const record = [...this.items.values()].find((u) => u.email === email);
    return record ? { ...record } : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const record = this.items.get(id);
    return record ? { ...record } : null;
  }
}

export class PrismaUsersRepository extends UsersRepository {
  constructor(private readonly prisma: PrismaClient = sharedPrisma()) {
    super();
  }

  create(data: NewUser): Promise<UserRecord> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
