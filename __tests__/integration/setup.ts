/**
 * Per-worker setup for integration tests.
 * Reads the Testcontainers DATABASE_URL and configures Prisma.
 */
import { readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const TC_URI_FILE = join(tmpdir(), '.chatstorm-testcontainers-pg-uri')

// Set DATABASE_URL before any Prisma import
if (process.env.USE_EXTERNAL_DB !== 'true') {
  try {
    const uri = readFileSync(TC_URI_FILE, 'utf-8').trim()
    process.env.DATABASE_URL = uri
  } catch {
    console.warn('[integration/setup] Could not read Testcontainers URI — using env DATABASE_URL')
  }
}
