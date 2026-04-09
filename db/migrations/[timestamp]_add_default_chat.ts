import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function main() {
  // Create initial branch for the default chat
  const defaultBranch = await prisma.branch.create({
    data: {
      id: "00000000-0000-0000-0000-000000000000",
      name: "main",
      type: "variant",
      chat: {
        create: {
          id: "00000000-0000-0000-0000-000000000000",
          title: "Development Chat",
          userId: "00000000-0000-0000-0000-000000000000",
          configId: "00000000-0000-0000-0000-000000000000",
          activeBranch: "00000000-0000-0000-0000-000000000000"
        }
      }
    }
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 