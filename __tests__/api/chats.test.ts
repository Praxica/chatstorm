import { prisma } from '@/lib/prisma'
import { BranchType } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

describe('Chat Creation', () => {
  let configId: string
  let userId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: 'test@test.com',
        password: 'test'
      }
    })
    userId = user.id

    const config = await prisma.config.create({
      data: {
        title: 'Test Config',
        userId: user.id,
      }
    })
    configId = config.id
  })

  afterAll(async () => {
    await prisma.$transaction([
      prisma.branch.deleteMany({ 
        where: { chat: { configId } } 
      }),
      prisma.chat.deleteMany({ 
        where: { configId } 
      }),
      prisma.config.delete({ 
        where: { id: configId } 
      }),
      prisma.user.delete({ 
        where: { id: userId } 
      })
    ])
  })

  it('should create a chat with a main branch', async () => {
    const chat = await prisma.chat.create({
      data: {
        title: 'Test Chat',
        configId,
        userId,
        branches: {
          create: {
            name: 'main',
            type: BranchType.variant
          }
        }
      },
      include: {
        branches: true
      }
    })

    const updatedChat = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        activeBranch: chat.branches[0].id,
        activeBranchPath: [chat.branches[0].id]
      },
      include: {
        branches: true
      }
    })

    expect(updatedChat.branches).toHaveLength(1)
    expect(updatedChat.activeBranch).toBeTruthy()
    expect(updatedChat.activeBranchPath).toHaveLength(1)
  })
}) 