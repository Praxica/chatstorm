/**
 * Integration tests for ConfigService.copyConfig()
 *
 * Uses a real PostgreSQL database provided by Testcontainers (via globalSetup).
 * The seeded test user '00000000-0000-0000-0000-000000000001' is used as the
 * owner for all test data.
 */
import { prisma } from '@/lib/prisma'
import { ConfigService } from '@/lib/services/ConfigService'
import type { Config, ChatAgent, ChatRound, RoundStance, Project } from '@prisma/client'

// Mock the ModalityRegistry to avoid loading the full modality system
jest.mock('@/lib/chat/modalities/ModalityRegistry', () => ({
  getModality: () => ({
    getRoundModerators: () => [],
  }),
  ModalityRegistry: {
    getInstance: () => ({
      getModality: () => ({
        getRoundModerators: () => [],
      }),
    }),
  },
}))

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'
const SECOND_USER_ID = '00000000-0000-0000-0000-000000000002'

type ConfigWithRelations = Config & {
  rounds: (ChatRound & {
    participants: ChatAgent[]
    stances: RoundStance[]
  })[]
  projects: Project[]
}

// Track all created resource IDs for cleanup
const createdConfigIds: string[] = []
const createdAgentIds: string[] = []

// Shared test fixtures
let agentA: ChatAgent
let agentB: ChatAgent
let agentC: ChatAgent

// Source configs created in beforeAll
let basicConfig: ConfigWithRelations
let threeRoundConfig: ConfigWithRelations
let debateConfigWithStances: ConfigWithRelations
let emptyConfig: ConfigWithRelations

beforeAll(async () => {
  // Create a second test user for cross-user copy tests
  await prisma.user.upsert({
    where: { id: SECOND_USER_ID },
    update: {},
    create: {
      id: SECOND_USER_ID,
      email: 'test2@chatstorm.dev',
      externalId: 'clerk_test_user_002',
    },
  })

  // Create test agents owned by the first user
  agentA = await prisma.chatAgent.create({
    data: {
      id: `test-agent-a-${Date.now()}`,
      name: 'Agent Alpha',
      role: 'Researcher',
      systemPrompt: 'You are a researcher.',
      priority: 'high',
      avatar: 'brain',
      model: 'gpt-4o',
      temperature: 0.7,
      isActive: true,
      userId: TEST_USER_ID,
    },
  })
  createdAgentIds.push(agentA.id)

  agentB = await prisma.chatAgent.create({
    data: {
      id: `test-agent-b-${Date.now()}`,
      name: 'Agent Beta',
      role: 'Critic',
      systemPrompt: 'You are a critic.',
      priority: 'medium',
      avatar: 'eye',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.5,
      isActive: true,
      userId: TEST_USER_ID,
    },
  })
  createdAgentIds.push(agentB.id)

  agentC = await prisma.chatAgent.create({
    data: {
      id: `test-agent-c-${Date.now()}`,
      name: 'Agent Gamma',
      role: 'Moderator',
      systemPrompt: 'You are a moderator.',
      priority: 'low',
      avatar: 'shield',
      model: null,
      temperature: null,
      isActive: true,
      userId: TEST_USER_ID,
    },
  })
  createdAgentIds.push(agentC.id)

  // ── Fixture 1: Basic config with one round and two participants ──
  const basicConfigRecord = await prisma.config.create({
    data: {
      title: 'Basic Test Config',
      userId: TEST_USER_ID,
      chatInstructions: 'Test instructions',
      examplePrompts: ['Prompt 1', 'Prompt 2'],
      rounds: {
        create: [
          {
            type: 'brainstorm',
            depth: 'medium',
            lengthType: 'total',
            lengthNumber: 10,
            sequence: 0,
            instructions: 'Brainstorm ideas',
            participants: { connect: [{ id: agentA.id }, { id: agentB.id }] },
          },
        ],
      },
    },
    include: {
      rounds: { include: { participants: true, stances: true }, orderBy: { sequence: 'asc' } },
      projects: true,
    },
  })
  basicConfig = basicConfigRecord as ConfigWithRelations
  createdConfigIds.push(basicConfig.id)

  // ── Fixture 2: Three-round config for order preservation test ──
  const threeRoundRecord = await prisma.config.create({
    data: {
      title: 'Three Round Config',
      userId: TEST_USER_ID,
      rounds: {
        create: [
          {
            type: 'brainstorm',
            depth: 'brief',
            lengthType: 'total',
            lengthNumber: 5,
            sequence: 0,
            name: 'Round Zero',
            participants: { connect: [{ id: agentA.id }] },
          },
          {
            type: 'critique',
            depth: 'thorough',
            lengthType: 'rounds',
            lengthRounds: 3,
            sequence: 1,
            name: 'Round One',
            participants: { connect: [{ id: agentA.id }, { id: agentB.id }] },
          },
          {
            type: 'explore',
            depth: 'exhaustive',
            lengthType: 'total',
            lengthNumber: 20,
            sequence: 2,
            name: 'Round Two',
            participants: { connect: [{ id: agentB.id }, { id: agentC.id }] },
          },
        ],
      },
    },
    include: {
      rounds: { include: { participants: true, stances: true }, orderBy: { sequence: 'asc' } },
      projects: true,
    },
  })
  threeRoundConfig = threeRoundRecord as ConfigWithRelations
  createdConfigIds.push(threeRoundConfig.id)

  // ── Fixture 3: Debate config with stances ──
  const debateRecord = await prisma.config.create({
    data: {
      title: 'Debate Config',
      userId: TEST_USER_ID,
      rounds: {
        create: [
          {
            type: 'debate',
            depth: 'medium',
            lengthType: 'rounds',
            lengthRounds: 2,
            sequence: 0,
            stanceType: 'assigned',
            participants: { connect: [{ id: agentA.id }, { id: agentB.id }] },
          },
        ],
      },
    },
    include: {
      rounds: { include: { participants: true, stances: true }, orderBy: { sequence: 'asc' } },
      projects: true,
    },
  })

  // Add stances after round creation
  const debateRound = debateRecord.rounds[0]
  await prisma.roundStance.createMany({
    data: [
      { roundId: debateRound.id, agentId: agentA.id, stance: 'Pro: AI will transform education' },
      { roundId: debateRound.id, agentId: agentB.id, stance: 'Con: AI risks in education' },
    ],
  })

  // Re-fetch to include stances
  debateConfigWithStances = (await prisma.config.findUniqueOrThrow({
    where: { id: debateRecord.id },
    include: {
      rounds: { include: { participants: true, stances: true }, orderBy: { sequence: 'asc' } },
      projects: true,
    },
  })) as ConfigWithRelations
  createdConfigIds.push(debateConfigWithStances.id)

  // ── Fixture 4: Empty config (no rounds) ──
  const emptyRecord = await prisma.config.create({
    data: {
      title: 'Empty Config',
      userId: TEST_USER_ID,
    },
    include: {
      rounds: { include: { participants: true, stances: true }, orderBy: { sequence: 'asc' } },
      projects: true,
    },
  })
  emptyConfig = emptyRecord as ConfigWithRelations
  createdConfigIds.push(emptyConfig.id)
})

afterAll(async () => {
  // Clean up all created data in reverse dependency order.
  // Delete configs first (cascades to rounds, stances, etc.), then agents, then the second user.
  // The seeded test user (TEST_USER_ID) must NOT be deleted.
  for (const configId of createdConfigIds) {
    await prisma.config.deleteMany({ where: { id: configId } })
  }
  for (const agentId of createdAgentIds) {
    await prisma.chatAgent.deleteMany({ where: { id: agentId } })
  }
  await prisma.user.deleteMany({ where: { id: SECOND_USER_ID } })
})

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe('ConfigService.copyConfig', () => {
  describe('with reuseAgents=true (same-user copy)', () => {
    it('creates a copy with a different ID but the same title with appended text', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, TEST_USER_ID, {
        appendToTitle: ' (Copy)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.id).not.toBe(basicConfig.id)
      expect(copy.title).toBe('Basic Test Config (Copy)')
      expect(copy.userId).toBe(TEST_USER_ID)
    })

    it('copies rounds with the same structure', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, TEST_USER_ID, {
        appendToTitle: ' (Struct)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.rounds).toHaveLength(basicConfig.rounds.length)
      const sourceRound = basicConfig.rounds[0]
      const copiedRound = copy.rounds[0]

      expect(copiedRound.id).not.toBe(sourceRound.id)
      expect(copiedRound.type).toBe(sourceRound.type)
      expect(copiedRound.depth).toBe(sourceRound.depth)
      expect(copiedRound.lengthType).toBe(sourceRound.lengthType)
      expect(copiedRound.lengthNumber).toBe(sourceRound.lengthNumber)
      expect(copiedRound.sequence).toBe(sourceRound.sequence)
      expect(copiedRound.instructions).toBe(sourceRound.instructions)
    })

    it('reuses the same agent IDs for participants', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, TEST_USER_ID, {
        appendToTitle: ' (Agents)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      const sourceParticipantIds = basicConfig.rounds[0].participants.map(p => p.id).sort()
      const copyParticipantIds = copy.rounds[0].participants.map((p: ChatAgent) => p.id).sort()

      expect(copyParticipantIds).toEqual(sourceParticipantIds)
    })

    it('preserves config-level fields', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, TEST_USER_ID, {
        appendToTitle: ' (Fields)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.chatInstructions).toBe(basicConfig.chatInstructions)
      expect(copy.examplePrompts).toEqual(basicConfig.examplePrompts)
    })
  })

  describe('with reuseAgents=false (cross-user copy)', () => {
    it('creates new agents for the destination user', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, SECOND_USER_ID, {
        appendToTitle: ' (Shared)',
        reuseAgents: false,
      })
      createdConfigIds.push(copy.id)

      // Collect all new agent IDs created during this copy
      const newParticipantIds = copy.rounds[0].participants.map((p: ChatAgent) => p.id)
      for (const id of newParticipantIds) {
        createdAgentIds.push(id)
      }

      // New agent IDs should differ from original
      const sourceParticipantIds = basicConfig.rounds[0].participants.map(p => p.id)
      for (const newId of newParticipantIds) {
        expect(sourceParticipantIds).not.toContain(newId)
      }

      // New config should be owned by second user
      expect(copy.userId).toBe(SECOND_USER_ID)
    })

    it('new agents belong to the destination user', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, SECOND_USER_ID, {
        appendToTitle: ' (Owner)',
        reuseAgents: false,
      })
      createdConfigIds.push(copy.id)

      const newParticipantIds = copy.rounds[0].participants.map((p: ChatAgent) => p.id)
      for (const id of newParticipantIds) {
        createdAgentIds.push(id)
      }

      // Verify each new agent is owned by the second user
      const newAgents = await prisma.chatAgent.findMany({
        where: { id: { in: newParticipantIds } },
      })

      for (const agent of newAgents) {
        expect(agent.userId).toBe(SECOND_USER_ID)
      }
    })

    it('copies agent properties to new agents', async () => {
      const copy = await ConfigService.copyConfig(basicConfig, SECOND_USER_ID, {
        appendToTitle: ' (Props)',
        appendToAgentNames: ' (copy)',
        reuseAgents: false,
      })
      createdConfigIds.push(copy.id)

      const newParticipantIds = copy.rounds[0].participants.map((p: ChatAgent) => p.id)
      for (const id of newParticipantIds) {
        createdAgentIds.push(id)
      }

      const newAgents = await prisma.chatAgent.findMany({
        where: { id: { in: newParticipantIds } },
      })

      // Find the agent that was copied from agentA (by checking the role)
      const copiedFromA = newAgents.find(a => a.role === agentA.role)
      expect(copiedFromA).toBeDefined()
      expect(copiedFromA!.name).toBe('Agent Alpha (copy)')
      expect(copiedFromA!.systemPrompt).toBe(agentA.systemPrompt)
      expect(copiedFromA!.priority).toBe(agentA.priority)
      expect(copiedFromA!.model).toBe(agentA.model)
      expect(copiedFromA!.temperature).toBe(agentA.temperature)
    })
  })

  describe('round order preservation', () => {
    it('preserves sequence order across 3 rounds', async () => {
      const copy = await ConfigService.copyConfig(threeRoundConfig, TEST_USER_ID, {
        appendToTitle: ' (Order)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.rounds).toHaveLength(3)

      // Verify sequences are preserved
      expect(copy.rounds[0].sequence).toBe(0)
      expect(copy.rounds[1].sequence).toBe(1)
      expect(copy.rounds[2].sequence).toBe(2)

      // Verify round types match the original order
      expect(copy.rounds[0].type).toBe('brainstorm')
      expect(copy.rounds[1].type).toBe('critique')
      expect(copy.rounds[2].type).toBe('explore')
    })

    it('preserves round names in order', async () => {
      const copy = await ConfigService.copyConfig(threeRoundConfig, TEST_USER_ID, {
        appendToTitle: ' (Names)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.rounds[0].name).toBe('Round Zero')
      expect(copy.rounds[1].name).toBe('Round One')
      expect(copy.rounds[2].name).toBe('Round Two')
    })

    it('preserves depth and length settings per round', async () => {
      const copy = await ConfigService.copyConfig(threeRoundConfig, TEST_USER_ID, {
        appendToTitle: ' (Depth)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.rounds[0].depth).toBe('brief')
      expect(copy.rounds[0].lengthType).toBe('total')
      expect(copy.rounds[0].lengthNumber).toBe(5)

      expect(copy.rounds[1].depth).toBe('thorough')
      expect(copy.rounds[1].lengthType).toBe('rounds')
      expect(copy.rounds[1].lengthRounds).toBe(3)

      expect(copy.rounds[2].depth).toBe('exhaustive')
      expect(copy.rounds[2].lengthType).toBe('total')
      expect(copy.rounds[2].lengthNumber).toBe(20)
    })
  })

  describe('stance copying', () => {
    it('copies stances with reuseAgents=true', async () => {
      const copy = await ConfigService.copyConfig(debateConfigWithStances, TEST_USER_ID, {
        appendToTitle: ' (Stances Reuse)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.rounds).toHaveLength(1)
      const copiedRound = copy.rounds[0]

      // Stances should exist on the copied round
      expect(copiedRound.stances).toHaveLength(2)

      // Agent IDs in stances should match originals since we reuse agents
      const stanceAgentIds = copiedRound.stances.map((s: RoundStance) => s.agentId).sort()
      expect(stanceAgentIds).toEqual([agentA.id, agentB.id].sort())

      // Verify stance text is preserved
      const stanceTexts = copiedRound.stances.map((s: RoundStance) => s.stance).sort()
      expect(stanceTexts).toEqual(
        ['Con: AI risks in education', 'Pro: AI will transform education']
      )
    })

    it('copies stances mapped to new agents with reuseAgents=false', async () => {
      const copy = await ConfigService.copyConfig(debateConfigWithStances, SECOND_USER_ID, {
        appendToTitle: ' (Stances New)',
        reuseAgents: false,
      })
      createdConfigIds.push(copy.id)

      // Track new agents for cleanup
      const newParticipantIds = copy.rounds[0].participants.map((p: ChatAgent) => p.id)
      for (const id of newParticipantIds) {
        createdAgentIds.push(id)
      }

      const copiedRound = copy.rounds[0]
      expect(copiedRound.stances).toHaveLength(2)

      // Stance agent IDs should be the NEW agents, not the originals
      const stanceAgentIds = copiedRound.stances.map((s: RoundStance) => s.agentId).sort()
      const originalAgentIds = [agentA.id, agentB.id].sort()
      for (const stanceAgentId of stanceAgentIds) {
        expect(originalAgentIds).not.toContain(stanceAgentId)
      }

      // Stance text should still be preserved
      const stanceTexts = copiedRound.stances.map((s: RoundStance) => s.stance).sort()
      expect(stanceTexts).toEqual(
        ['Con: AI risks in education', 'Pro: AI will transform education']
      )
    })
  })

  describe('empty config handling', () => {
    it('can copy a config with no rounds', async () => {
      const copy = await ConfigService.copyConfig(emptyConfig, TEST_USER_ID, {
        appendToTitle: ' (Empty Copy)',
        reuseAgents: true,
      })
      createdConfigIds.push(copy.id)

      expect(copy.id).not.toBe(emptyConfig.id)
      expect(copy.title).toBe('Empty Config (Empty Copy)')
      expect(copy.rounds).toHaveLength(0)
      expect(copy.userId).toBe(TEST_USER_ID)
    })
  })
})
