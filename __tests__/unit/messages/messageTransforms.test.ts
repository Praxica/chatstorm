/**
 * Tests for the canonical ChatMessage transforms.
 *
 * Verifies that fromDbMessage() and fromUIMessage() produce identical
 * canonical shapes from their respective origins, ensuring that downstream
 * code (sanitizeMessages, buildLlmMessages) works correctly regardless
 * of where messages originate.
 */

import { fromDbMessage, fromUIMessage, type ChatMessage } from '@/lib/schemas/message'
import { createDbMessage, createClientMessage } from '../../factories'

describe('fromDbMessage', () => {
  it('maps chatRoundSessionId to metadata.sessionId', () => {
    const db = createDbMessage({ sessionId: 'sess-1', agentId: 'agent-a' })
    const msg = fromDbMessage(db)

    expect(msg.metadata.sessionId).toBe('sess-1')
    expect(msg.metadata.agentId).toBe('agent-a')
  })

  it('prefers metadata.sessionId over chatRoundSessionId when both exist', () => {
    const db = {
      id: 'msg-1',
      role: 'assistant',
      content: { parts: [{ type: 'text', text: 'hello' }] },
      chatRoundSessionId: 'db-session',
      agentId: null,
      metadata: { sessionId: 'meta-session' },
      annotations: [],
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    }
    const msg = fromDbMessage(db)
    expect(msg.metadata.sessionId).toBe('meta-session')
  })

  it('extracts parts from content JSON', () => {
    const db = createDbMessage({ content: 'Hello world' })
    const msg = fromDbMessage(db)

    expect(msg.parts).toHaveLength(1)
    expect(msg.parts[0]).toEqual({ type: 'text', text: 'Hello world' })
  })

  it('handles legacy string content', () => {
    const db = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Legacy string content',
      metadata: {},
      chatRoundSessionId: null,
      agentId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    }
    const msg = fromDbMessage(db)

    expect(msg.parts).toEqual([{ type: 'text', text: 'Legacy string content' }])
  })

  it('handles legacy object content with .content string', () => {
    const db = {
      id: 'msg-1',
      role: 'assistant',
      content: { content: 'Legacy object content' },
      metadata: {},
      chatRoundSessionId: null,
      agentId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    }
    const msg = fromDbMessage(db)

    expect(msg.parts).toEqual([{ type: 'text', text: 'Legacy object content' }])
  })

  it('builds usage from DB token columns', () => {
    const db = createDbMessage({})
    ;(db as any).promptTokens = 100
    ;(db as any).completionTokens = 50
    ;(db as any).totalTokens = 150

    const msg = fromDbMessage(db)
    expect(msg.metadata.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    })
  })

  it('maps agentId column to metadata.agentId', () => {
    const db = createDbMessage({ agentId: 'agent-x' })
    const msg = fromDbMessage(db)
    expect(msg.metadata.agentId).toBe('agent-x')
  })

  it('adds data-progress part from metadata', () => {
    const db = createDbMessage({})
    ;(db as any).metadata.progress = { step: 'round-1' }

    const msg = fromDbMessage(db)
    expect(msg.parts.find(p => p.type === 'data-progress')).toBeTruthy()
  })

  it('returns null for missing optional fields', () => {
    const db = createDbMessage({ role: 'user', content: 'Hi' })
    const msg = fromDbMessage(db)

    expect(msg.metadata.agentId).toBeNull()
    expect(msg.metadata.sessionId).toBeNull()
    expect(msg.metadata.roundId).toBeNull()
  })
})

describe('fromUIMessage', () => {
  it('passes through metadata.sessionId directly', () => {
    const ui = createClientMessage({ sessionId: 'sess-1', agentId: 'agent-a' })
    const msg = fromUIMessage(ui)

    expect(msg.metadata.sessionId).toBe('sess-1')
    expect(msg.metadata.agentId).toBe('agent-a')
  })

  it('normalizes parts from content string when parts are missing', () => {
    const ui = { role: 'assistant', content: 'Hello from content' }
    const msg = fromUIMessage(ui)

    expect(msg.parts).toEqual([{ type: 'text', text: 'Hello from content' }])
  })

  it('preserves existing parts array', () => {
    const ui = createClientMessage({ content: 'My text' })
    const msg = fromUIMessage(ui)

    expect(msg.parts).toEqual([{ type: 'text', text: 'My text' }])
  })

  it('returns null for missing optional fields', () => {
    const ui = { role: 'user', parts: [{ type: 'text', text: 'Hi' }] }
    const msg = fromUIMessage(ui)

    expect(msg.metadata.agentId).toBeNull()
    expect(msg.metadata.sessionId).toBeNull()
    expect(msg.metadata.roundId).toBeNull()
  })

  it('generates empty id when not provided', () => {
    const ui = { role: 'user', parts: [{ type: 'text', text: 'Hi' }] }
    const msg = fromUIMessage(ui)
    expect(msg.id).toBe('')
  })
})

describe('Transform equivalence', () => {
  it('DB and client messages produce identical canonical shapes for the same data', () => {
    const dbMsg = createDbMessage({
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello world',
      agentId: 'agent-a',
      sessionId: 'sess-1',
      roundId: 'round-1',
    })

    const clientMsg = createClientMessage({
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello world',
      agentId: 'agent-a',
      sessionId: 'sess-1',
      roundId: 'round-1',
    })

    const fromDb = fromDbMessage(dbMsg)
    const fromClient = fromUIMessage(clientMsg)

    // Both should have the same canonical structure
    expect(fromDb.id).toBe(fromClient.id)
    expect(fromDb.role).toBe(fromClient.role)
    expect(fromDb.metadata.agentId).toBe(fromClient.metadata.agentId)
    expect(fromDb.metadata.sessionId).toBe(fromClient.metadata.sessionId)
    expect(fromDb.metadata.roundId).toBe(fromClient.metadata.roundId)

    // Text content should match
    const dbText = fromDb.parts.find(p => p.type === 'text')?.text
    const clientText = fromClient.parts.find(p => p.type === 'text')?.text
    expect(dbText).toBe(clientText)
  })

  it('DB message without metadata.sessionId still gets sessionId from chatRoundSessionId', () => {
    // This is the exact scenario that caused the bug in commit 6fb1252
    const dbMsg = {
      id: 'msg-1',
      role: 'assistant',
      content: { parts: [{ type: 'text', text: 'Hello' }] },
      chatRoundSessionId: 'sess-1',
      agentId: 'agent-a',
      metadata: { roundId: 'round-1' }, // note: NO sessionId in metadata
      annotations: [],
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    }

    const msg = fromDbMessage(dbMsg)
    expect(msg.metadata.sessionId).toBe('sess-1')
  })

  it('client message without chatRoundSessionId still has sessionId in metadata', () => {
    // Client messages never have chatRoundSessionId — they only use metadata
    const clientMsg = {
      id: 'msg-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hello' }],
      metadata: { sessionId: 'sess-1', agentId: 'agent-a' },
      // NO chatRoundSessionId
    }

    const msg = fromUIMessage(clientMsg)
    expect(msg.metadata.sessionId).toBe('sess-1')
  })
})
