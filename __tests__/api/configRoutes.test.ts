import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET as getConfigs, POST as createConfig } from '@/app/api/configs/route'
import {
  GET as getRounds,
  POST as createRound,
} from '@/app/api/configs/[configId]/rounds/route'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

// Track IDs created during tests for cleanup
const createdConfigIds: string[] = []

afterAll(async () => {
  // Clean up all configs (and their rounds via cascade) created during tests
  if (createdConfigIds.length > 0) {
    await prisma.chatRound.deleteMany({
      where: { configId: { in: createdConfigIds } },
    })
    await prisma.config.deleteMany({
      where: { id: { in: createdConfigIds } },
    })
  }
})

// ---------------------------------------------------------------------------
// GET /api/configs
// ---------------------------------------------------------------------------

describe('GET /api/configs', () => {
  let configId: string

  beforeAll(async () => {
    const config = await prisma.config.create({
      data: {
        title: 'GET Configs Test',
        userId: TEST_USER_ID,
        rounds: {
          create: {
            type: 'brainstorm',
            depth: 'medium',
            lengthType: 'rounds',
            lengthRounds: 1,
            sequence: 0,
          },
        },
      },
    })
    configId = config.id
    createdConfigIds.push(configId)
  })

  it('returns configs for the authenticated user', async () => {
    const req = new NextRequest('http://localhost/api/configs', {
      method: 'GET',
    })

    const response = await getConfigs(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)

    const found = body.find((c: any) => c.id === configId)
    expect(found).toBeDefined()
    expect(found.title).toBe('GET Configs Test')
    expect(found.userId).toBe(TEST_USER_ID)

    // Should include rounds in the response
    expect(Array.isArray(found.rounds)).toBe(true)
    expect(found.rounds.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// POST /api/configs
// ---------------------------------------------------------------------------

describe('POST /api/configs', () => {
  it('creates a config with a default round when type is provided', async () => {
    const req = new NextRequest('http://localhost/api/configs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Config With Default Round',
        type: 'debate',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await createConfig(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    createdConfigIds.push(body.id)

    expect(body.title).toBe('Config With Default Round')
    expect(body.userId).toBe(TEST_USER_ID)
    expect(body.rounds).toHaveLength(1)
    expect(body.rounds[0].type).toBe('debate')
    expect(body.rounds[0].sequence).toBe(0)

    // Verify it was persisted
    const persisted = await prisma.config.findUnique({
      where: { id: body.id },
      include: { rounds: true },
    })
    expect(persisted).not.toBeNull()
    expect(persisted!.rounds).toHaveLength(1)
  })

  it('creates a config with custom rounds', async () => {
    const customRounds = [
      {
        id: crypto.randomUUID(),
        type: 'brainstorm',
        depth: 'brief',
        lengthType: 'rounds',
        lengthRounds: 2,
        sequence: 0,
        participantOrder: 'default',
        transition: 'auto',
      },
      {
        id: crypto.randomUUID(),
        type: 'critique',
        depth: 'thorough',
        lengthType: 'rounds',
        lengthRounds: 1,
        sequence: 1,
        participantOrder: 'default',
        transition: 'user',
      },
    ]

    const req = new NextRequest('http://localhost/api/configs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Config With Custom Rounds',
        rounds: customRounds,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await createConfig(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    createdConfigIds.push(body.id)

    expect(body.title).toBe('Config With Custom Rounds')
    expect(body.rounds).toHaveLength(2)

    // Rounds should be in sequence order
    const sorted = [...body.rounds].sort(
      (a: any, b: any) => a.sequence - b.sequence
    )
    expect(sorted[0].type).toBe('brainstorm')
    expect(sorted[0].depth).toBe('brief')
    expect(sorted[0].lengthRounds).toBe(2)
    expect(sorted[1].type).toBe('critique')
    expect(sorted[1].depth).toBe('thorough')
    expect(sorted[1].transition).toBe('user')
  })
})

// ---------------------------------------------------------------------------
// GET /api/configs/[configId]/rounds
// ---------------------------------------------------------------------------

describe('GET /api/configs/[configId]/rounds', () => {
  let configId: string

  beforeAll(async () => {
    const config = await prisma.config.create({
      data: {
        title: 'GET Rounds Test Config',
        userId: TEST_USER_ID,
        rounds: {
          create: [
            {
              type: 'explore',
              depth: 'medium',
              lengthType: 'rounds',
              lengthRounds: 1,
              sequence: 0,
            },
            {
              type: 'review',
              depth: 'thorough',
              lengthType: 'total',
              lengthNumber: 3,
              sequence: 1,
            },
          ],
        },
      },
    })
    configId = config.id
    createdConfigIds.push(configId)
  })

  it('returns rounds for the given config', async () => {
    const req = new Request(`http://localhost/api/configs/${configId}/rounds`)

    const response = await getRounds(req, {
      params: Promise.resolve({ configId }),
    })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)

    // Should be ordered by sequence
    expect(body[0].sequence).toBe(0)
    expect(body[0].type).toBe('explore')
    expect(body[1].sequence).toBe(1)
    expect(body[1].type).toBe('review')

    // Should include participants and stances relations
    expect(body[0]).toHaveProperty('participants')
    expect(body[0]).toHaveProperty('stances')
  })
})

// ---------------------------------------------------------------------------
// POST /api/configs/[configId]/rounds
// ---------------------------------------------------------------------------

describe('POST /api/configs/[configId]/rounds', () => {
  let configId: string

  beforeAll(async () => {
    const config = await prisma.config.create({
      data: {
        title: 'POST Rounds Test Config',
        userId: TEST_USER_ID,
      },
    })
    configId = config.id
    createdConfigIds.push(configId)
  })

  it('creates a round with valid data (Zod validation)', async () => {
    const roundId = crypto.randomUUID()
    const roundData = {
      id: roundId,
      type: 'debate',
      depth: 'medium',
      lengthType: 'rounds',
      lengthRounds: 1,
      sequence: 0,
      participants: [],
    }

    const req = new Request(
      `http://localhost/api/configs/${configId}/rounds`,
      {
        method: 'POST',
        body: JSON.stringify(roundData),
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await createRound(req, {
      params: Promise.resolve({ configId }),
    })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.id).toBe(roundId)
    expect(body.type).toBe('debate')
    expect(body.depth).toBe('medium')

    // Verify persistence
    const persisted = await prisma.chatRound.findUnique({
      where: { id: roundId },
    })
    expect(persisted).not.toBeNull()
    expect(persisted!.configId).toBe(configId)
    expect(persisted!.type).toBe('debate')
  })

  it('rejects invalid round data (missing required fields)', async () => {
    const invalidData = {
      id: crypto.randomUUID(),
      // Missing 'type' (required)
      // Missing 'sequence' (required)
      depth: 'medium',
    }

    const req = new Request(
      `http://localhost/api/configs/${configId}/rounds`,
      {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const response = await createRound(req, {
      params: Promise.resolve({ configId }),
    })

    // The handler catches ZodError and returns 500 with error message
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toBe('Failed to create round')
  })
})
