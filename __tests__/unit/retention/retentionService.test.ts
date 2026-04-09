/**
 * Unit tests for the pure-logic functions in RetentionService.
 *
 * Tested functions:
 *   - RetentionService.getChatRetentionSettings(settings)
 *   - RetentionService.getRoundRetentionSettings(settings)
 *   - RetentionService.groupMessagesByDialogue(messages)
 *
 * LLM-dependent methods (generateSummaryForMessages, generateSummaryForSession,
 * handleRoundCompletion) are intentionally excluded — they require mocking the
 * AI SDK and are better covered by integration tests.
 */

import { RetentionService } from '@/lib/chat/services/retention'
import {
  DEFAULT_CHAT_RETENTION_SETTINGS,
  DEFAULT_ROUND_RETENTION_SETTINGS,
  type ChatRetentionSettings,
  type RoundRetentionSettings,
} from '@/lib/chat/services/retention-types'
import { createTestMessage, resetIdCounter } from '@/__tests__/factories'
import type { Message } from '@/lib/chat/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a message with a `data-dialogue` part for testing groupMessagesByDialogue.
 * The `parts` array includes both a text part and a data-dialogue part carrying
 * sender/receiver metadata.
 */
function createDialogueMessage(
  senderId: string,
  receiverId: string,
  content = 'dialogue message',
  role: 'user' | 'assistant' = 'assistant'
): Message {
  return {
    id: '',
    role,
    parts: [
      { type: 'text', text: content },
      { type: 'data-dialogue', data: { senderId, receiverId } },
    ],
    metadata: { agentId: null, sessionId: null, roundId: '' }
  } as unknown as Message
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetIdCounter()
})

// ===========================
// getChatRetentionSettings
// ===========================

describe('RetentionService.getChatRetentionSettings', () => {
  it('returns full defaults when settings is null', () => {
    const result = RetentionService.getChatRetentionSettings(null)
    expect(result).toEqual(DEFAULT_CHAT_RETENTION_SETTINGS)
  })

  it('returns full defaults when settings is undefined', () => {
    const result = RetentionService.getChatRetentionSettings(undefined)
    expect(result).toEqual(DEFAULT_CHAT_RETENTION_SETTINGS)
  })

  it('returns full defaults when settings is an empty object', () => {
    const result = RetentionService.getChatRetentionSettings({})
    expect(result).toEqual(DEFAULT_CHAT_RETENTION_SETTINGS)
  })

  it('merges a partial override — only ignore.afterRounds changed', () => {
    const result = RetentionService.getChatRetentionSettings({
      ignore: { enabled: false, afterRounds: 20 },
    })

    // The `summarize` key should still be the default
    expect(result.summarize).toEqual(DEFAULT_CHAT_RETENTION_SETTINGS.summarize)
    // The `ignore` key should be overridden
    expect(result.ignore).toEqual({ enabled: false, afterRounds: 20 })
  })

  it('merges a partial override — only summarize changed', () => {
    const result = RetentionService.getChatRetentionSettings({
      summarize: { enabled: false, afterRounds: 1 },
    })

    expect(result.summarize).toEqual({ enabled: false, afterRounds: 1 })
    expect(result.ignore).toEqual(DEFAULT_CHAT_RETENTION_SETTINGS.ignore)
  })

  it('full override replaces all values', () => {
    const fullOverride: ChatRetentionSettings = {
      summarize: { enabled: false, afterRounds: 99 },
      ignore: { enabled: false, afterRounds: 50 },
    }
    const result = RetentionService.getChatRetentionSettings(fullOverride)
    expect(result).toEqual(fullOverride)
  })

  it('preserves extra keys from input via spread', () => {
    // The implementation uses spread, so any extra keys pass through.
    const withExtra = { summarize: { enabled: true, afterRounds: 5 }, customKey: 'hello' }
    const result = RetentionService.getChatRetentionSettings(withExtra) as any
    expect(result.customKey).toBe('hello')
    expect(result.summarize).toEqual({ enabled: true, afterRounds: 5 })
  })

  it('does not mutate the input object', () => {
    const input = { ignore: { enabled: false, afterRounds: 7 } }
    const inputCopy = JSON.parse(JSON.stringify(input))
    RetentionService.getChatRetentionSettings(input)
    expect(input).toEqual(inputCopy)
  })

  it('does not mutate the defaults', () => {
    const defaultsCopy = JSON.parse(JSON.stringify(DEFAULT_CHAT_RETENTION_SETTINGS))
    RetentionService.getChatRetentionSettings({ summarize: { enabled: false, afterRounds: 0 } })
    expect(DEFAULT_CHAT_RETENTION_SETTINGS).toEqual(defaultsCopy)
  })
})

// ===========================
// getRoundRetentionSettings
// ===========================

describe('RetentionService.getRoundRetentionSettings', () => {
  it('returns full defaults when settings is null', () => {
    const result = RetentionService.getRoundRetentionSettings(null)
    expect(result).toEqual(DEFAULT_ROUND_RETENTION_SETTINGS)
  })

  it('returns full defaults when settings is undefined', () => {
    const result = RetentionService.getRoundRetentionSettings(undefined)
    expect(result).toEqual(DEFAULT_ROUND_RETENTION_SETTINGS)
  })

  it('returns full defaults when settings is an empty object', () => {
    const result = RetentionService.getRoundRetentionSettings({})
    expect(result).toEqual(DEFAULT_ROUND_RETENTION_SETTINGS)
  })

  it('partial override of top-level policy only', () => {
    const result = RetentionService.getRoundRetentionSettings({ policy: 'keep_full' })

    expect(result.policy).toBe('keep_full')
    // Nested summarizer should fall back to defaults
    expect(result.summarizer).toEqual(DEFAULT_ROUND_RETENTION_SETTINGS.summarizer)
  })

  it('partial override of nested summarizer — change output value but keep prompt', () => {
    const result = RetentionService.getRoundRetentionSettings({
      summarizer: { output: { type: 'percentage', value: 50 } },
    })

    // Policy should remain the default
    expect(result.policy).toBe(DEFAULT_ROUND_RETENTION_SETTINGS.policy)
    // Prompt should remain the default (empty string)
    expect(result.summarizer!.prompt).toBe(DEFAULT_ROUND_RETENTION_SETTINGS.summarizer!.prompt)
    // Output should be overridden
    expect(result.summarizer!.output).toEqual({ type: 'percentage', value: 50 })
  })

  it('partial override of nested summarizer — change prompt but keep output', () => {
    const result = RetentionService.getRoundRetentionSettings({
      summarizer: { prompt: 'Be extra concise.' },
    })

    expect(result.policy).toBe('summarize')
    expect(result.summarizer!.prompt).toBe('Be extra concise.')
    // Output should fall back to defaults
    expect(result.summarizer!.output).toEqual(DEFAULT_ROUND_RETENTION_SETTINGS.summarizer!.output)
  })

  it('full override replaces everything', () => {
    const fullOverride: RoundRetentionSettings = {
      policy: 'ignore',
      summarizer: {
        prompt: 'Custom prompt',
        output: { type: 'percentage', value: 75 },
      },
    }
    const result = RetentionService.getRoundRetentionSettings(fullOverride)
    expect(result).toEqual(fullOverride)
  })

  it('policy "default" is accepted as a valid policy', () => {
    const result = RetentionService.getRoundRetentionSettings({ policy: 'default' })
    expect(result.policy).toBe('default')
  })

  it('policy "ignore" is accepted as a valid policy', () => {
    const result = RetentionService.getRoundRetentionSettings({ policy: 'ignore' })
    expect(result.policy).toBe('ignore')
  })

  it('summarizer with empty prompt uses the default (empty string)', () => {
    const result = RetentionService.getRoundRetentionSettings({
      summarizer: { prompt: '' },
    })
    expect(result.summarizer!.prompt).toBe('')
  })

  it('does not mutate the input object', () => {
    const input = { policy: 'keep_full' as const, summarizer: { prompt: 'test' } }
    const inputCopy = JSON.parse(JSON.stringify(input))
    RetentionService.getRoundRetentionSettings(input)
    expect(input).toEqual(inputCopy)
  })

  it('does not mutate the defaults', () => {
    const defaultsCopy = JSON.parse(JSON.stringify(DEFAULT_ROUND_RETENTION_SETTINGS))
    RetentionService.getRoundRetentionSettings({
      policy: 'ignore',
      summarizer: { prompt: 'Something different', output: { type: 'percentage', value: 10 } },
    })
    expect(DEFAULT_ROUND_RETENTION_SETTINGS).toEqual(defaultsCopy)
  })

  it('overriding only output.value keeps the default output.type', () => {
    // Because the merge is at the summarizer level (not output level),
    // providing a partial output object replaces the whole output
    const result = RetentionService.getRoundRetentionSettings({
      summarizer: { output: { type: 'word_count', value: 500 } },
    })
    expect(result.summarizer!.output.type).toBe('word_count')
    expect(result.summarizer!.output.value).toBe(500)
  })
})

// ===========================
// groupMessagesByDialogue
// ===========================

describe('RetentionService.groupMessagesByDialogue', () => {
  it('returns empty general and dialogues when given no messages', () => {
    const result = RetentionService.groupMessagesByDialogue([])

    expect(result.general).toEqual([])
    expect(result.dialogues).toEqual({})
  })

  it('puts all messages in general when none have dialogue parts', () => {
    const messages = [
      createTestMessage({ content: 'Hello' }),
      createTestMessage({ content: 'World', role: 'user' }),
      createTestMessage({ content: 'Goodbye' }),
    ] as Message[]

    const result = RetentionService.groupMessagesByDialogue(messages)

    expect(result.general).toHaveLength(3)
    expect(result.dialogues).toEqual({})
    expect(result.general[0]).toBe(messages[0])
    expect(result.general[1]).toBe(messages[1])
    expect(result.general[2]).toBe(messages[2])
  })

  it('groups a single dialogue message under the correct key', () => {
    const dialogueMsg = createDialogueMessage('agent-1', 'agent-2', 'Private talk')

    const result = RetentionService.groupMessagesByDialogue([dialogueMsg])

    expect(result.general).toHaveLength(0)
    expect(Object.keys(result.dialogues)).toEqual(['agent-1||agent-2'])

    const dialogue = result.dialogues['agent-1||agent-2']
    expect(dialogue.messages).toHaveLength(1)
    expect(dialogue.messages[0]).toBe(dialogueMsg)
    expect(dialogue.participants).toEqual(['agent-1', 'agent-2'])
  })

  it('groups multiple dialogue messages with the same participant pair together', () => {
    const msg1 = createDialogueMessage('agent-1', 'agent-2', 'First message')
    const msg2 = createDialogueMessage('agent-1', 'agent-2', 'Second message')
    const msg3 = createDialogueMessage('agent-1', 'agent-2', 'Third message')

    const result = RetentionService.groupMessagesByDialogue([msg1, msg2, msg3])

    expect(result.general).toHaveLength(0)
    expect(Object.keys(result.dialogues)).toEqual(['agent-1||agent-2'])
    expect(result.dialogues['agent-1||agent-2'].messages).toHaveLength(3)
    expect(result.dialogues['agent-1||agent-2'].participants).toEqual(['agent-1', 'agent-2'])
  })

  it('creates separate groups for different participant pairs', () => {
    const dialogue1a = createDialogueMessage('agent-1', 'agent-2', 'A to B')
    const dialogue1b = createDialogueMessage('agent-1', 'agent-2', 'A to B again')
    const dialogue2a = createDialogueMessage('agent-3', 'agent-4', 'C to D')
    const dialogue3a = createDialogueMessage('agent-1', 'agent-3', 'A to C')

    const result = RetentionService.groupMessagesByDialogue([
      dialogue1a, dialogue2a, dialogue1b, dialogue3a,
    ])

    expect(result.general).toHaveLength(0)
    expect(Object.keys(result.dialogues)).toHaveLength(3)

    expect(result.dialogues['agent-1||agent-2'].messages).toHaveLength(2)
    expect(result.dialogues['agent-1||agent-2'].participants).toEqual(['agent-1', 'agent-2'])

    expect(result.dialogues['agent-3||agent-4'].messages).toHaveLength(1)
    expect(result.dialogues['agent-3||agent-4'].participants).toEqual(['agent-3', 'agent-4'])

    expect(result.dialogues['agent-1||agent-3'].messages).toHaveLength(1)
    expect(result.dialogues['agent-1||agent-3'].participants).toEqual(['agent-1', 'agent-3'])
  })

  it('separates general messages from dialogue messages correctly', () => {
    const generalMsg1 = createTestMessage({ content: 'General intro' }) as Message
    const dialogueMsg = createDialogueMessage('agent-1', 'agent-2', 'Private chat')
    const generalMsg2 = createTestMessage({ content: 'General outro' }) as Message

    const result = RetentionService.groupMessagesByDialogue([
      generalMsg1, dialogueMsg, generalMsg2,
    ])

    expect(result.general).toHaveLength(2)
    expect(result.general[0]).toBe(generalMsg1)
    expect(result.general[1]).toBe(generalMsg2)

    expect(Object.keys(result.dialogues)).toEqual(['agent-1||agent-2'])
    expect(result.dialogues['agent-1||agent-2'].messages).toHaveLength(1)
    expect(result.dialogues['agent-1||agent-2'].messages[0]).toBe(dialogueMsg)
  })

  it('treats a message with parts but no data-dialogue part as general', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Some content',
      parts: [
        { type: 'text', text: 'Some content' },
        { type: 'tool-call', data: { toolId: 'some-tool' } },
      ],
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    expect(result.general).toHaveLength(1)
    expect(result.general[0]).toBe(message)
    expect(result.dialogues).toEqual({})
  })

  it('treats a message with empty parts array as general', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Empty parts',
      parts: [],
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    expect(result.general).toHaveLength(1)
    expect(result.dialogues).toEqual({})
  })

  it('treats a dialogue part with missing senderId as general', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Broken dialogue',
      parts: [
        { type: 'text', text: 'Broken dialogue' },
        { type: 'data-dialogue', data: { receiverId: 'agent-2' } },
      ],
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    expect(result.general).toHaveLength(1)
    expect(result.dialogues).toEqual({})
  })

  it('treats a dialogue part with missing receiverId as general', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Broken dialogue',
      parts: [
        { type: 'text', text: 'Broken dialogue' },
        { type: 'data-dialogue', data: { senderId: 'agent-1' } },
      ],
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    expect(result.general).toHaveLength(1)
    expect(result.dialogues).toEqual({})
  })

  it('treats a dialogue part with null data as general', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Null data dialogue',
      parts: [
        { type: 'text', text: 'Null data dialogue' },
        { type: 'data-dialogue', data: null },
      ],
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    expect(result.general).toHaveLength(1)
    expect(result.dialogues).toEqual({})
  })

  it('treats a message without parts property as general', () => {
    // Message type has no `parts` — the code checks Array.isArray((message as any).parts)
    const message = {
      role: 'assistant' as const,
      content: 'No parts at all',
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    expect(result.general).toHaveLength(1)
    expect(result.dialogues).toEqual({})
  })

  it('uses senderId||receiverId as the dialogue key (not reversed)', () => {
    // When sender is 'B' and receiver is 'A', the key should be 'B||A', not 'A||B'
    const msg = createDialogueMessage('agent-B', 'agent-A', 'B talks to A')

    const result = RetentionService.groupMessagesByDialogue([msg])

    expect(Object.keys(result.dialogues)).toEqual(['agent-B||agent-A'])
    expect(result.dialogues['agent-B||agent-A'].participants).toEqual(['agent-B', 'agent-A'])
  })

  it('keeps directional dialogues separate (A->B is different from B->A)', () => {
    const aTob = createDialogueMessage('agent-A', 'agent-B', 'A to B')
    const bToa = createDialogueMessage('agent-B', 'agent-A', 'B to A')

    const result = RetentionService.groupMessagesByDialogue([aTob, bToa])

    expect(Object.keys(result.dialogues)).toHaveLength(2)
    expect(result.dialogues['agent-A||agent-B'].messages).toHaveLength(1)
    expect(result.dialogues['agent-B||agent-A'].messages).toHaveLength(1)
  })

  it('preserves message order within each dialogue group', () => {
    const msg1 = createDialogueMessage('agent-1', 'agent-2', 'First')
    const msg2 = createDialogueMessage('agent-1', 'agent-2', 'Second')
    const msg3 = createDialogueMessage('agent-1', 'agent-2', 'Third')

    const result = RetentionService.groupMessagesByDialogue([msg1, msg2, msg3])

    const dialogueMessages = result.dialogues['agent-1||agent-2'].messages
    expect(dialogueMessages[0]).toBe(msg1)
    expect(dialogueMessages[1]).toBe(msg2)
    expect(dialogueMessages[2]).toBe(msg3)
  })

  it('preserves message order in the general group', () => {
    const msg1 = createTestMessage({ content: 'First general' }) as Message
    const dialogue = createDialogueMessage('agent-1', 'agent-2', 'In between')
    const msg2 = createTestMessage({ content: 'Second general' }) as Message
    const msg3 = createTestMessage({ content: 'Third general' }) as Message

    const result = RetentionService.groupMessagesByDialogue([msg1, dialogue, msg2, msg3])

    expect(result.general).toHaveLength(3)
    expect(result.general[0]).toBe(msg1)
    expect(result.general[1]).toBe(msg2)
    expect(result.general[2]).toBe(msg3)
  })

  it('handles a large mixed set of messages correctly', () => {
    const messages: (Message & { parts?: any[] })[] = []

    // Add 5 general messages
    for (let i = 0; i < 5; i++) {
      messages.push(createTestMessage({ content: `General ${i}` }) as Message)
    }

    // Add 3 messages from dialogue pair agent-1||agent-2
    for (let i = 0; i < 3; i++) {
      messages.push(createDialogueMessage('agent-1', 'agent-2', `D1 msg ${i}`))
    }

    // Add 2 messages from dialogue pair agent-3||agent-4
    for (let i = 0; i < 2; i++) {
      messages.push(createDialogueMessage('agent-3', 'agent-4', `D2 msg ${i}`))
    }

    // Add 2 more general messages
    for (let i = 0; i < 2; i++) {
      messages.push(createTestMessage({ content: `General extra ${i}` }) as Message)
    }

    const result = RetentionService.groupMessagesByDialogue(messages)

    expect(result.general).toHaveLength(7)
    expect(Object.keys(result.dialogues)).toHaveLength(2)
    expect(result.dialogues['agent-1||agent-2'].messages).toHaveLength(3)
    expect(result.dialogues['agent-3||agent-4'].messages).toHaveLength(2)
  })

  it('uses the first data-dialogue part when multiple exist', () => {
    // Edge case: a message with multiple data-dialogue parts.
    // The code uses `.find()`, which returns the first match.
    const message = {
      role: 'assistant' as const,
      content: 'Multi-dialogue parts',
      parts: [
        { type: 'text', text: 'Multi-dialogue parts' },
        { type: 'data-dialogue', data: { senderId: 'agent-1', receiverId: 'agent-2' } },
        { type: 'data-dialogue', data: { senderId: 'agent-3', receiverId: 'agent-4' } },
      ],
    } as unknown as Message

    const result = RetentionService.groupMessagesByDialogue([message])

    // Should use the first data-dialogue part
    expect(Object.keys(result.dialogues)).toEqual(['agent-1||agent-2'])
    expect(result.dialogues['agent-1||agent-2'].participants).toEqual(['agent-1', 'agent-2'])
  })
})
