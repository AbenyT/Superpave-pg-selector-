import { PrismaClient } from '@prisma/client';

/** True when DATABASE_URL is set: analyses and accounts go to PostgreSQL, otherwise they stay in memory. */
export function usesDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let client: PrismaClient | null = null;

/** One database connection pool shared by the analyses and the accounts. */
export function sharedPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}
