/**
 * Tests for the round Zod schema validation.
 *
 * Validates that roundInputSchema correctly parses, applies defaults,
 * and rejects invalid input for round configuration objects.
 */

import { roundInputSchema, ROUND_DEFAULTS, MESSAGE_SENDER_MODES } from '@/lib/schemas/round'
import {
  RoundType,
  DepthLevel,
  LengthType,
  ParticipantOrder,
  TransitionType,
  RoundActionType,
  ParticipantMode,
  ParticipantLengthType,
  DialogueMode,
  MessageGenerationMode,
  DialogueLengthMode,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// roundInputSchema validation
// ---------------------------------------------------------------------------

describe('roundInputSchema', () => {
  // Minimal valid input helper
  const minimal = { type: RoundType.brainstorm, sequence: 0 }

  describe('minimal input', () => {
    it('accepts valid minimal input (type + sequence)', () => {
      const result = roundInputSchema.safeParse(minimal)
      expect(result.success).toBe(true)
    })

    it('rejects input missing required type field', () => {
      const result = roundInputSchema.safeParse({ sequence: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects input missing required sequence field', () => {
      const result = roundInputSchema.safeParse({ type: RoundType.brainstorm })
      expect(result.success).toBe(false)
    })
  })

  describe('defaults', () => {
    it('applies correct default for depth', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.depth).toBe(DepthLevel.medium)
    })

    it('applies correct default for lengthType', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.lengthType).toBe(LengthType.rounds)
    })

    it('applies correct default for participants', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.participants).toEqual([])
    })

    it('applies correct default for participantOrder', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.participantOrder).toBe(ParticipantOrder.default)
    })

    it('applies correct default for stances', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.stances).toEqual([])
    })

    it('applies correct default for creativityType', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.creativityType).toBe('agent')
    })

    it('applies correct default for showPrompts', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.showPrompts).toBe(false)
    })

    it('applies correct default for agentQuestions', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.agentQuestions).toBe(false)
    })

    it('applies correct default for agentSelfReflection', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.agentSelfReflection).toBe(false)
    })

    it('applies correct default for agentIsolation', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.agentIsolation).toBe(false)
    })

    it('applies correct default for isPrivate', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.isPrivate).toBe(false)
    })

    it('applies correct default for modelSelectionMode', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.modelSelectionMode).toBe('agent')
    })

    it('applies correct default for transition', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.transition).toBe(TransitionType.user)
    })

    it('applies correct default for dialogueSelectedSenders', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.dialogueSelectedSenders).toEqual([])
    })

    it('applies correct default for dialogueSelectedReceivers', () => {
      const result = roundInputSchema.parse(minimal)
      expect(result.dialogueSelectedReceivers).toEqual([])
    })
  })

  describe('type field validation', () => {
    it.each(Object.values(RoundType))('accepts valid RoundType: %s', (type) => {
      const result = roundInputSchema.safeParse({ ...minimal, type })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.type).toBe(type)
    })

    it('rejects invalid type value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, type: 'invalid_type' })
      expect(result.success).toBe(false)
    })

    it('rejects numeric type value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, type: 42 })
      expect(result.success).toBe(false)
    })

    it('rejects empty string type value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, type: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('depth field validation', () => {
    it.each(Object.values(DepthLevel))('accepts valid DepthLevel: %s', (depth) => {
      const result = roundInputSchema.safeParse({ ...minimal, depth })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.depth).toBe(depth)
    })

    it('rejects invalid depth value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, depth: 'ultra' })
      expect(result.success).toBe(false)
    })
  })

  describe('lengthType field validation', () => {
    it.each(Object.values(LengthType))('accepts valid LengthType: %s', (lengthType) => {
      const result = roundInputSchema.safeParse({ ...minimal, lengthType })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.lengthType).toBe(lengthType)
    })

    it('rejects invalid lengthType value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, lengthType: 'per_agent' })
      expect(result.success).toBe(false)
    })
  })

  describe('participantOrder field validation', () => {
    it.each(Object.values(ParticipantOrder))(
      'accepts valid ParticipantOrder: %s',
      (participantOrder) => {
        const result = roundInputSchema.safeParse({ ...minimal, participantOrder })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.participantOrder).toBe(participantOrder)
      },
    )

    it('rejects invalid participantOrder value', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        participantOrder: 'alphabetical',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('transition field validation', () => {
    it.each(Object.values(TransitionType))(
      'accepts valid TransitionType: %s',
      (transition) => {
        const result = roundInputSchema.safeParse({ ...minimal, transition })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.transition).toBe(transition)
      },
    )

    it('rejects invalid transition value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, transition: 'timed' })
      expect(result.success).toBe(false)
    })
  })

  describe('optional string fields', () => {
    it('accepts name as string', () => {
      const result = roundInputSchema.safeParse({ ...minimal, name: 'Round 1' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.name).toBe('Round 1')
    })

    it('accepts name as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, name: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.name).toBeNull()
    })

    it('accepts icon as string', () => {
      const result = roundInputSchema.safeParse({ ...minimal, icon: 'brain' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.icon).toBe('brain')
    })

    it('accepts instructions as string', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        instructions: 'Be creative',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.instructions).toBe('Be creative')
    })

    it('accepts instructions as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, instructions: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.instructions).toBeNull()
    })
  })

  describe('participants field validation', () => {
    it('accepts array of strings', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        participants: ['agent-1', 'agent-2'],
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.participants).toEqual(['agent-1', 'agent-2'])
    })

    it('accepts empty array', () => {
      const result = roundInputSchema.safeParse({ ...minimal, participants: [] })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.participants).toEqual([])
    })

    it('rejects array of non-strings', () => {
      const result = roundInputSchema.safeParse({ ...minimal, participants: [1, 2, 3] })
      expect(result.success).toBe(false)
    })

    it('rejects non-array value', () => {
      const result = roundInputSchema.safeParse({ ...minimal, participants: 'agent-1' })
      expect(result.success).toBe(false)
    })
  })

  describe('stances array validation', () => {
    it('accepts valid stances array', () => {
      const stances = [
        { agentId: 'agent-1', stance: 'for' },
        { agentId: 'agent-2', stance: 'against' },
      ]
      const result = roundInputSchema.safeParse({ ...minimal, stances })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.stances).toHaveLength(2)
        expect(result.data.stances[0].agentId).toBe('agent-1')
        expect(result.data.stances[0].stance).toBe('for')
      }
    })

    it('accepts empty stances array', () => {
      const result = roundInputSchema.safeParse({ ...minimal, stances: [] })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.stances).toEqual([])
    })

    it('rejects stance missing agentId', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        stances: [{ stance: 'for' }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects stance missing stance field', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        stances: [{ agentId: 'agent-1' }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-array stances', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        stances: { agentId: 'agent-1', stance: 'for' },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('boolean fields', () => {
    it('accepts agentIsolation as true', () => {
      const result = roundInputSchema.safeParse({ ...minimal, agentIsolation: true })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.agentIsolation).toBe(true)
    })

    it('accepts agentIsolation as false', () => {
      const result = roundInputSchema.safeParse({ ...minimal, agentIsolation: false })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.agentIsolation).toBe(false)
    })

    it('rejects non-boolean agentIsolation', () => {
      const result = roundInputSchema.safeParse({ ...minimal, agentIsolation: 'yes' })
      expect(result.success).toBe(false)
    })

    it('accepts isPrivate as true', () => {
      const result = roundInputSchema.safeParse({ ...minimal, isPrivate: true })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.isPrivate).toBe(true)
    })

    it('accepts isPrivate as false', () => {
      const result = roundInputSchema.safeParse({ ...minimal, isPrivate: false })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.isPrivate).toBe(false)
    })

    it('rejects non-boolean isPrivate', () => {
      const result = roundInputSchema.safeParse({ ...minimal, isPrivate: 1 })
      expect(result.success).toBe(false)
    })

    it('accepts showPrompts as true', () => {
      const result = roundInputSchema.safeParse({ ...minimal, showPrompts: true })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.showPrompts).toBe(true)
    })

    it('accepts agentQuestions as true', () => {
      const result = roundInputSchema.safeParse({ ...minimal, agentQuestions: true })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.agentQuestions).toBe(true)
    })

    it('accepts agentSelfReflection as true', () => {
      const result = roundInputSchema.safeParse({ ...minimal, agentSelfReflection: true })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.agentSelfReflection).toBe(true)
    })
  })

  describe('sequence field validation', () => {
    it('accepts sequence as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, sequence: 5 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.sequence).toBe(5)
    })

    it('accepts sequence as zero', () => {
      const result = roundInputSchema.safeParse({ ...minimal, sequence: 0 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.sequence).toBe(0)
    })

    it('rejects sequence as string', () => {
      const result = roundInputSchema.safeParse({ ...minimal, sequence: 'first' })
      expect(result.success).toBe(false)
    })
  })

  describe('retentionSettings validation', () => {
    it('accepts JSON-compatible object', () => {
      const retentionSettings = { keepLast: 10, compress: true }
      const result = roundInputSchema.safeParse({ ...minimal, retentionSettings })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.retentionSettings).toEqual(retentionSettings)
    })

    it('accepts null-like values', () => {
      const result = roundInputSchema.safeParse({ ...minimal, retentionSettings: null })
      expect(result.success).toBe(true)
    })

    it('accepts nested object', () => {
      const retentionSettings = {
        strategy: 'sliding_window',
        options: { windowSize: 20, overlap: 5 },
      }
      const result = roundInputSchema.safeParse({ ...minimal, retentionSettings })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.retentionSettings).toEqual(retentionSettings)
    })
  })

  describe('dataTool validation', () => {
    it('accepts JSON-compatible object', () => {
      const dataTool = { extract: ['summary', 'sentiment'] }
      const result = roundInputSchema.safeParse({ ...minimal, dataTool })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.dataTool).toEqual(dataTool)
    })

    it('accepts null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, dataTool: null })
      expect(result.success).toBe(true)
    })

    it('accepts complex nested structure', () => {
      const dataTool = {
        tool: 'extract',
        schema: { type: 'object', properties: { score: { type: 'number' } } },
      }
      const result = roundInputSchema.safeParse({ ...minimal, dataTool })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.dataTool).toEqual(dataTool)
    })
  })

  describe('modelSelectionMode validation', () => {
    it.each(['agent', 'random', 'specific'] as const)(
      'accepts valid modelSelectionMode: %s',
      (mode) => {
        const result = roundInputSchema.safeParse({
          ...minimal,
          modelSelectionMode: mode,
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.modelSelectionMode).toBe(mode)
      },
    )

    it('rejects invalid modelSelectionMode', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        modelSelectionMode: 'weighted',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('enum optional fields', () => {
    it.each(Object.values(RoundActionType))('accepts valid action: %s', (action) => {
      const result = roundInputSchema.safeParse({ ...minimal, action })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.action).toBe(action)
    })

    it('accepts action as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, action: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.action).toBeNull()
    })

    it('rejects invalid action', () => {
      const result = roundInputSchema.safeParse({ ...minimal, action: 'eliminate' })
      expect(result.success).toBe(false)
    })

    it.each(Object.values(ParticipantMode))(
      'accepts valid participantMode: %s',
      (participantMode) => {
        const result = roundInputSchema.safeParse({ ...minimal, participantMode })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.participantMode).toBe(participantMode)
      },
    )

    it.each(Object.values(ParticipantLengthType))(
      'accepts valid participantLengthType: %s',
      (participantLengthType) => {
        const result = roundInputSchema.safeParse({ ...minimal, participantLengthType })
        expect(result.success).toBe(true)
        if (result.success)
          expect(result.data.participantLengthType).toBe(participantLengthType)
      },
    )
  })

  describe('dialogue fields', () => {
    it.each(Object.values(DialogueMode))(
      'accepts valid dialogueSenderMode: %s',
      (dialogueSenderMode) => {
        const result = roundInputSchema.safeParse({ ...minimal, dialogueSenderMode })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.dialogueSenderMode).toBe(dialogueSenderMode)
      },
    )

    it.each(Object.values(DialogueMode))(
      'accepts valid dialogueReceiverMode: %s',
      (dialogueReceiverMode) => {
        const result = roundInputSchema.safeParse({ ...minimal, dialogueReceiverMode })
        expect(result.success).toBe(true)
        if (result.success)
          expect(result.data.dialogueReceiverMode).toBe(dialogueReceiverMode)
      },
    )

    it('accepts dialogueSenderMode as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, dialogueSenderMode: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.dialogueSenderMode).toBeNull()
    })

    it.each(Object.values(MessageGenerationMode))(
      'accepts valid dialogueInitialMessageMode: %s',
      (dialogueInitialMessageMode) => {
        const result = roundInputSchema.safeParse({
          ...minimal,
          dialogueInitialMessageMode,
        })
        expect(result.success).toBe(true)
        if (result.success)
          expect(result.data.dialogueInitialMessageMode).toBe(dialogueInitialMessageMode)
      },
    )

    it.each(Object.values(DialogueLengthMode))(
      'accepts valid dialogueLengthMode: %s',
      (dialogueLengthMode) => {
        const result = roundInputSchema.safeParse({ ...minimal, dialogueLengthMode })
        expect(result.success).toBe(true)
        if (result.success)
          expect(result.data.dialogueLengthMode).toBe(dialogueLengthMode)
      },
    )

    it('accepts dialogueSelectedSenders as array of strings', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        dialogueSelectedSenders: ['agent-1', 'agent-2'],
      })
      expect(result.success).toBe(true)
      if (result.success)
        expect(result.data.dialogueSelectedSenders).toEqual(['agent-1', 'agent-2'])
    })

    it('accepts dialogueLength as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, dialogueLength: 5 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.dialogueLength).toBe(5)
    })

    it('accepts dialogueLength as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, dialogueLength: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.dialogueLength).toBeNull()
    })
  })

  describe('numeric nullable fields', () => {
    it('accepts lengthNumber as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, lengthNumber: 10 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.lengthNumber).toBe(10)
    })

    it('accepts lengthNumber as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, lengthNumber: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.lengthNumber).toBeNull()
    })

    it('accepts lengthRounds as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, lengthRounds: 3 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.lengthRounds).toBe(3)
    })

    it('accepts lengthRounds as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, lengthRounds: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.lengthRounds).toBeNull()
    })

    it('accepts outputNumber as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, outputNumber: 5 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.outputNumber).toBe(5)
    })

    it('accepts creativityNumber as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, creativityNumber: 0.8 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.creativityNumber).toBe(0.8)
    })

    it('accepts participantLength as number', () => {
      const result = roundInputSchema.safeParse({ ...minimal, participantLength: 4 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.participantLength).toBe(4)
    })
  })

  describe('selectedModel field', () => {
    it('accepts selectedModel as string', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        selectedModel: 'gpt-4o',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.selectedModel).toBe('gpt-4o')
    })

    it('accepts selectedModel as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, selectedModel: null })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.selectedModel).toBeNull()
    })
  })

  describe('transition condition fields', () => {
    it('accepts transitionConditions as array of objects', () => {
      const conditions = [
        { roundId: 'round-1', condition: 'score > 5' },
        { roundId: 'round-2', condition: 'consensus reached' },
      ]
      const result = roundInputSchema.safeParse({
        ...minimal,
        transition: TransitionType.conditional,
        transitionConditions: conditions,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.transitionConditions).toHaveLength(2)
        expect(result.data.transitionConditions![0].roundId).toBe('round-1')
      }
    })

    it('accepts transitionConditions as null', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        transitionConditions: null,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.transitionConditions).toBeNull()
    })

    it('rejects transitionConditions with missing roundId', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        transitionConditions: [{ condition: 'score > 5' }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects transitionConditions with missing condition', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        transitionConditions: [{ roundId: 'round-1' }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('message sender fields (non-dialogue)', () => {
    it.each([...MESSAGE_SENDER_MODES])(
      'accepts valid messageSenderMode: %s',
      (messageSenderMode) => {
        const result = roundInputSchema.safeParse({ ...minimal, messageSenderMode })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.messageSenderMode).toBe(messageSenderMode)
      },
    )

    it.each(['select', 'agent_decides'])(
      'rejects unsupported messageSenderMode: %s',
      (messageSenderMode) => {
        const result = roundInputSchema.safeParse({ ...minimal, messageSenderMode })
        expect(result.success).toBe(false)
      },
    )

    it('accepts messageSenderMode as null', () => {
      const result = roundInputSchema.safeParse({ ...minimal, messageSenderMode: null })
      expect(result.success).toBe(true)
    })

    it('accepts messageSenderInstructions as string', () => {
      const result = roundInputSchema.safeParse({
        ...minimal,
        messageSenderInstructions: 'Send to all',
      })
      expect(result.success).toBe(true)
      if (result.success)
        expect(result.data.messageSenderInstructions).toBe('Send to all')
    })
  })

  describe('full complex input', () => {
    it('accepts a fully-populated round configuration', () => {
      const fullInput = {
        type: RoundType.debate,
        depth: DepthLevel.thorough,
        lengthType: LengthType.total,
        lengthNumber: 10,
        lengthRounds: 3,
        sequence: 1,
        name: 'Opening Debate',
        icon: 'swords',
        participants: ['agent-1', 'agent-2', 'agent-3'],
        participantMode: ParticipantMode.SELECT,
        participantOrder: ParticipantOrder.random,
        stances: [
          { agentId: 'agent-1', stance: 'for' },
          { agentId: 'agent-2', stance: 'against' },
        ],
        creativityType: 'agent',
        action: RoundActionType.summarize,
        instructions: 'Discuss climate policy',
        showPrompts: true,
        agentQuestions: true,
        agentSelfReflection: true,
        agentIsolation: true,
        isPrivate: false,
        modelSelectionMode: 'specific' as const,
        selectedModel: 'claude-3-opus',
        transition: TransitionType.auto,
        retentionSettings: { keepLast: 5 },
        dataTool: { extract: ['summary'] },
      }

      const result = roundInputSchema.safeParse(fullInput)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe(RoundType.debate)
        expect(result.data.depth).toBe(DepthLevel.thorough)
        expect(result.data.name).toBe('Opening Debate')
        expect(result.data.participants).toHaveLength(3)
        expect(result.data.stances).toHaveLength(2)
        expect(result.data.agentIsolation).toBe(true)
        expect(result.data.transition).toBe(TransitionType.auto)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// ROUND_DEFAULTS
// ---------------------------------------------------------------------------

describe('ROUND_DEFAULTS', () => {
  it('has expected default type value', () => {
    expect(ROUND_DEFAULTS.type).toBe(RoundType.brainstorm)
  })

  it('has expected default sequence value', () => {
    expect(ROUND_DEFAULTS.sequence).toBe(0)
  })

  it('has expected default depth value', () => {
    expect(ROUND_DEFAULTS.depth).toBe(DepthLevel.medium)
  })

  it('has expected default lengthType value', () => {
    expect(ROUND_DEFAULTS.lengthType).toBe(LengthType.rounds)
  })

  it('has expected default participantOrder value', () => {
    expect(ROUND_DEFAULTS.participantOrder).toBe(ParticipantOrder.default)
  })

  it('has expected default transition value', () => {
    expect(ROUND_DEFAULTS.transition).toBe(TransitionType.user)
  })

  it('has expected default participants value', () => {
    expect(ROUND_DEFAULTS.participants).toEqual([])
  })

  it('has expected default stances value', () => {
    expect(ROUND_DEFAULTS.stances).toEqual([])
  })

  it('has expected default creativityType value', () => {
    expect(ROUND_DEFAULTS.creativityType).toBe('agent')
  })

  it('has expected default modelSelectionMode value', () => {
    expect(ROUND_DEFAULTS.modelSelectionMode).toBe('agent')
  })

  it('has expected default boolean values', () => {
    expect(ROUND_DEFAULTS.showPrompts).toBe(false)
    expect(ROUND_DEFAULTS.agentQuestions).toBe(false)
    expect(ROUND_DEFAULTS.agentSelfReflection).toBe(false)
    expect(ROUND_DEFAULTS.agentIsolation).toBe(false)
    expect(ROUND_DEFAULTS.isPrivate).toBe(false)
  })

  it('all default enum values are valid Prisma enum members', () => {
    expect(Object.values(RoundType)).toContain(ROUND_DEFAULTS.type)
    expect(Object.values(DepthLevel)).toContain(ROUND_DEFAULTS.depth)
    expect(Object.values(LengthType)).toContain(ROUND_DEFAULTS.lengthType)
    expect(Object.values(ParticipantOrder)).toContain(ROUND_DEFAULTS.participantOrder)
    expect(Object.values(TransitionType)).toContain(ROUND_DEFAULTS.transition)
  })

  it('produces the same result as parsing minimal input', () => {
    const parsed = roundInputSchema.parse({
      type: RoundType.brainstorm,
      sequence: 0,
    })
    expect(parsed).toEqual(ROUND_DEFAULTS)
  })
})
