import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

async function setupTestDb() {
  try {
    // Reset and run migrations
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' })
    
    console.log('Test database setup complete')
  } catch (error) {
    console.error('Error setting up test database:', error)
    process.exit(1)
  }
}

export default setupTestDb 