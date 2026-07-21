import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Helper to check database connection
export async function checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { connected: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('Database connection error:', message)
    return {
      connected: false,
      error: message.includes('connect')
        ? 'Cannot connect to database. Please check if MySQL is running and DATABASE_URL is correct.'
        : message
    }
  }
}

// Helper to handle Prisma errors with user-friendly messages
export function getPrismaErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('connect') || message.includes('connection')) {
      return 'Database connection failed. Please ensure the database server is running.'
    }
    if (message.includes('timeout')) {
      return 'Database request timed out. Please try again.'
    }
    if (message.includes('unique constraint')) {
      return 'A record with this information already exists.'
    }
    if (message.includes('foreign key constraint')) {
      return 'Cannot complete this operation due to related records.'
    }
    if (message.includes('not found')) {
      return 'The requested record was not found.'
    }
  }
  return 'A database error occurred. Please try again later.'
}
