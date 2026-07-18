import { PrismaClient } from '@prisma/client'
import { join } from 'path'

// Ensure DATABASE_URL is always set (fallback for preview envs without .env)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${join(process.cwd(), 'db', 'custom.db')}`
}

// Ensure db directory exists
try {
  const fs = require('fs')
  const dbDir = join(process.cwd(), 'db')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
} catch {}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? [] : ["error"],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db