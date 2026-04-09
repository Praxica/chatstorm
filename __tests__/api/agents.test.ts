import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

describe('ChatAgent API', () => {
  let userId1: string
  let userId2: string
  let agent1Id = 'test-agent-1'
  let agent2Id = 'test-agent-2'

  beforeAll(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: 'test1@test.com',
        password: 'test1'
      }
    })
    userId1 = user1.id

    const user2 = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: 'test2@test.com',
        password: 'test2'
      }
    })
    userId2 = user2.id

    // Create test agents for different users
    await prisma.chatAgent.createMany({
      data: [
        {
          id: agent1Id,
          userId: userId1,
          name: 'Test Agent 1',
          role: 'test',
          systemPrompt: 'test prompt',
          priority: 'high'
        },
        {
          id: agent2Id,
          userId: userId2,
          name: 'Test Agent 2',
          role: 'test',
          systemPrompt: 'test prompt',
          priority: 'medium'
        }
      ],
      skipDuplicates: true
    })
  })

  afterAll(async () => {
    // Clean up
    await prisma.chatAgent.deleteMany({
      where: { id: { in: [agent1Id, agent2Id] } }
    })
    await prisma.user.deleteMany({
      where: { id: { in: [userId1, userId2] } }
    })
  })

  it('should only return agents for the specified user', async () => {
    const user1Agents = await prisma.chatAgent.findMany({
      where: { userId: userId1 }
    })

    const user2Agents = await prisma.chatAgent.findMany({
      where: { userId: userId2 }
    })

    expect(user1Agents).toHaveLength(1)
    expect(user2Agents).toHaveLength(1)
    expect(user1Agents[0].id).toBe(agent1Id)
    expect(user2Agents[0].id).toBe(agent2Id)
  })

  it('should create an agent for a specific user', async () => {
    const newAgentId = 'test-agent-3'
    
    const agent = await prisma.chatAgent.create({
      data: {
        id: newAgentId,
        userId: userId1,
        name: 'Test Agent 3',
        role: 'test',
        systemPrompt: 'test prompt',
        priority: 'low'
      }
    })

    expect(agent.userId).toBe(userId1)
    expect(agent.name).toBe('Test Agent 3')

    // Clean up
    await prisma.chatAgent.delete({
      where: { id: newAgentId }
    })
  })

  it('should only allow updates by the owner user', async () => {
    // Try to update agent1 (owned by user1) with user2
    const updateResult = await prisma.chatAgent.updateMany({
      where: {
        id: agent1Id,
        userId: userId2 // This should match no records since agent1 belongs to user1
      },
      data: {
        name: 'Updated Name'
      }
    })

    expect(updateResult.count).toBe(0) // No records should be updated

    // Verify the name wasn't changed
    const agent = await prisma.chatAgent.findUnique({
      where: { id: agent1Id }
    })
    expect(agent?.name).toBe('Test Agent 1')
  })

  it('should only allow deletion by the owner user', async () => {
    const newAgentId = 'test-agent-4'
    
    // Create a test agent for user1
    await prisma.chatAgent.create({
      data: {
        id: newAgentId,
        userId: userId1,
        name: 'Test Agent 4',
        role: 'test',
        systemPrompt: 'test prompt',
        priority: 'low'
      }
    })

    // Try to delete using user2
    const deleteResult = await prisma.chatAgent.deleteMany({
      where: {
        id: newAgentId,
        userId: userId2 // This should match no records since the agent belongs to user1
      }
    })

    expect(deleteResult.count).toBe(0) // No records should be deleted

    // Verify the agent still exists
    const agent = await prisma.chatAgent.findUnique({
      where: { id: newAgentId }
    })
    expect(agent).toBeTruthy()

    // Clean up properly with correct user
    await prisma.chatAgent.delete({
      where: { id: newAgentId }
    })
  })
}) 