import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const db = global.prisma ?? new PrismaClient({
    adapter: process.env.NODE_ENV === "development" ? new PrismaPg({ connectionString: process.env.DATABASE_URL }) : undefined,
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default db;
