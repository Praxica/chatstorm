#!/bin/bash
set -e

echo "Safely adding ChatBatch models without risking data loss..."

# First, make sure our Prisma schema is updated with the latest model definitions
echo "Generating Prisma client to ensure schema is up to date..."
npx prisma generate

# Create a migration that will be safer (doesn't reset schema)
echo "Creating a migration without resetting the database..."
npx prisma migrate dev --name add_batch_chat_models --create-only

echo "Migration created! Please check the migration file manually before applying it with:"
echo "npx prisma migrate deploy"
echo ""
echo "After confirming the migration looks good, you can apply it with:"
echo "npx prisma migrate deploy" 