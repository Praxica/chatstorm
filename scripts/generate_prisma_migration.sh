#!/bin/bash
set -e

# Generate Prisma migration for batch chat models
echo "Generating Prisma migration for batch chat models..."
npx prisma migrate dev --name add_batch_chat_models

echo "Migration created successfully. Now run 'npx prisma generate' to update the Prisma client." 