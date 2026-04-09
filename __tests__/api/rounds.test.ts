import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { RoundType, DepthLevel, LengthType } from '@prisma/client'

describe('ChatRound API', () => {
  let configId: string
  let agent1Id = 'agent-1'
  let agent2Id = 'agent-2'

  beforeAll(async () => {
    const testUserId = uuidv4()
    // Create test user first
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'rounds-test@test.com',
      }
    })

    // Create test agents
    await prisma.chatAgent.createMany({
      data: [
        {
          id: agent1Id,
          name: 'Test Agent 1',
          role: 'test',
          systemPrompt: 'test prompt',
          priority: 'high',
          userId: testUserId
        },
        {
          id: agent2Id,
          name: 'Test Agent 2',
          role: 'test',
          systemPrompt: 'test prompt',
          priority: 'medium',
          userId: testUserId
        }
      ],
      skipDuplicates: true
    })

    // Create a test config
    const config = await prisma.config.create({
      data: {
        title: 'Test Config',
        userId: testUserId,
      }
    })
    configId = config.id
  })

  afterAll(async () => {
    // Clean up
    await prisma.chatRound.deleteMany({
      where: { configId }
    })
    await prisma.config.delete({
      where: { id: configId }
    })
    await prisma.chatAgent.deleteMany({
      where: { id: { in: [agent1Id, agent2Id] } }
    })
  })

  it('should create a round and persist it', async () => {
    const roundData = {
      type: 'debate' as RoundType,
      depth: 'medium' as DepthLevel,
      lengthType: 'rounds' as LengthType,
      lengthNumber: null,
      lengthRounds: 1,
      sequence: 0,
      participants: [agent1Id]
    }

    // Create round
    const round = await prisma.chatRound.create({
      data: {
        configId,
        type: roundData.type,
        depth: roundData.depth,
        lengthType: roundData.lengthType,
        lengthNumber: roundData.lengthNumber,
        lengthRounds: roundData.lengthRounds,
        sequence: roundData.sequence,
        participants: {
          connect: roundData.participants.map(id => ({ id }))
        }
      }
    })

    // Verify round was created
    const savedRound = await prisma.chatRound.findUnique({
      where: { id: round.id },
      include: { participants: true }
    })

    expect(savedRound).toBeTruthy()
    expect(savedRound?.configId).toBe(configId)
    expect(savedRound?.type).toBe(roundData.type)
    expect(savedRound?.participants).toHaveLength(1)
    expect(savedRound?.participants[0].id).toBe(agent1Id)
  })

  it('should update rounds and persist changes', async () => {
    // Create initial rounds
    await prisma.chatRound.createMany({
      data: [
        {
          configId,
          type: 'debate' as RoundType,
          depth: 'brief' as DepthLevel,
          lengthType: 'rounds' as LengthType,
          lengthRounds: 1,
          sequence: 0
        },
        {
          configId,
          type: 'review' as RoundType,
          depth: 'medium' as DepthLevel,
          lengthType: 'total' as LengthType,
          lengthNumber: 5,
          sequence: 1
        }
      ]
    })

    // Update rounds
    await prisma.chatRound.deleteMany({
      where: { configId }
    })

    const updatedRoundData = [{
      type: 'critique' as RoundType,
      depth: 'thorough' as DepthLevel,
      lengthType: 'rounds' as LengthType,
      lengthRounds: 2,
      sequence: 0,
      participants: [agent1Id, agent2Id]
    }]

    for (const round of updatedRoundData) {
      await prisma.chatRound.create({
        data: {
          configId,
          type: round.type,
          depth: round.depth,
          lengthType: round.lengthType,
          lengthRounds: round.lengthRounds,
          sequence: round.sequence,
          participants: {
            connect: round.participants.map(id => ({ id }))
          }
        }
      })
    }

    // Verify updates
    const savedRounds = await prisma.chatRound.findMany({
      where: { configId },
      include: { participants: true },
      orderBy: { sequence: 'asc' }
    })

    expect(savedRounds).toHaveLength(1)
    expect(savedRounds[0].type).toBe('critique')
    expect(savedRounds[0].participants).toHaveLength(2)
  })
}) 