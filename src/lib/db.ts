import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton: reuse one client across hot reloads in dev,
// avoid exhausting Postgres connections. https://pris.ly/d/help/next-js-best-practices
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
