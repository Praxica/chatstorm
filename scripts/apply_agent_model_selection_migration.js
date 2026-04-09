// Script to add the modelSelectionMode and selectedModels fields to ChatAgent table
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Applying migration: Adding model selection fields to ChatAgent...');
    
    // Execute raw SQL to add the columns
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "ChatAgent" 
      ADD COLUMN IF NOT EXISTS "modelSelectionMode" TEXT DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS "selectedModels" TEXT[] DEFAULT ARRAY[]::TEXT[];
    `);
    
    console.log('Migration applied successfully!');
    
    // Generate Prisma client to recognize the new fields
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