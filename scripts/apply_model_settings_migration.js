// Script to add the modelSettings field to UserCapabilities table
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Applying migration: Adding modelSettings to UserCapabilities...');
    
    // Execute raw SQL to add the column
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "UserCapabilities" 
      ADD COLUMN IF NOT EXISTS "modelSettings" JSONB NOT NULL DEFAULT '{"mode":"all","includedModels":[],"excludedModels":[]}';
    `);
    
    console.log('Migration applied successfully!');
    
    // Generate Prisma client to recognize the new field
    console.log('Please run "npx prisma generate" to update the Prisma client.');
    
    return { success: true };
  } catch (error) {
    console.error('Error applying migration:', error);
    return { success: false, error };
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 