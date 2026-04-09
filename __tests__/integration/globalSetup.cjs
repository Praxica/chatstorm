/**
 * Jest global setup: starts a PostgreSQL container via Testcontainers,
 * runs Prisma migrations, and seeds a test user.
 *
 * The container connection URI is written to a temp file so that
 * worker processes (which run in separate threads) can read it.
 */
const { execSync } = require('child_process')
const { writeFileSync, mkdirSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

const TC_URI_FILE = join(tmpdir(), '.chatstorm-testcontainers-pg-uri')

module.exports = async function globalSetup() {
  // Skip Testcontainers if an external DB is provided
  if (process.env.USE_EXTERNAL_DB === 'true') {
    console.log('[globalSetup] USE_EXTERNAL_DB=true — skipping Testcontainers')
    return
  }

  console.log('[globalSetup] Starting PostgreSQL container…')
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('chatstorm_test')
    .withUsername('test')
    .withPassword('test')
    .start()

  const connectionUri = container.getConnectionUri()
  console.log('[globalSetup] Container started, running migrations…')

  // Write the URI so worker processes can pick it up
  writeFileSync(TC_URI_FILE, connectionUri, 'utf-8')

  // Push Prisma schema (faster than migrate deploy for tests — no migration history needed)
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'pipe',
  })

  // Seed a test user that the auth mock will resolve to
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient({ datasources: { db: { url: connectionUri } } })
  try {
    await prisma.user.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@chatstorm.dev',
        externalId: 'clerk_test_user_001',
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  // Store container reference for teardown
  globalThis.__POSTGRES_CONTAINER__ = container
  console.log('[globalSetup] Ready.')
}
