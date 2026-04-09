/**
 * Jest global teardown: stops the PostgreSQL container.
 */
const { unlinkSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

const TC_URI_FILE = join(tmpdir(), '.chatstorm-testcontainers-pg-uri')

module.exports = async function globalTeardown() {
  if (process.env.USE_EXTERNAL_DB === 'true') return

  const container = globalThis.__POSTGRES_CONTAINER__
  if (container) {
    console.log('[globalTeardown] Stopping PostgreSQL container…')
    await container.stop()
  }

  // Clean up temp file
  try {
    unlinkSync(TC_URI_FILE)
  } catch {
    // Ignore if already cleaned up
  }
}
