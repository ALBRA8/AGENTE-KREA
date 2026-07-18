import { PrismaClient } from '@prisma/client'

// Set DATABASE_URL if not already set (works without .env file)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${process.cwd()}/db/custom.db`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? [] : ["error"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db