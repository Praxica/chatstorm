// Script to add the modelSelectionMode and selectedModel fields to ChatRound table
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Applying migration: Adding model selection fields to ChatRound...');
    
    // Execute raw SQL to add the columns
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "ChatRound" 
      ADD COLUMN IF NOT EXISTS "modelSelectionMode" TEXT NOT NULL DEFAULT 'agent',
      ADD COLUMN IF NOT EXISTS "selectedModel" TEXT;
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