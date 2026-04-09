/**
 * Test assertion helpers for ChatStorm message and chat state validation.
 *
 * Provides semantic, readable assertions so tests read like specifications:
 *
 *   expectMessagesFromAgents(messages, ['Agent A', 'Agent B'])
 *   expectNoMessagesFromAgent(messages, 'Agent C')
 *   expectMessageCount(messages, 5)
 *   expectActiveRound(progress, 'round-1')
 */

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/**
 * Extract text content from a message (handles parts-based format).
 */
export function getMessageText(msg: any): string {
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p?.type === 'text')
      .map((p: any) => String(p.text ?? ''))
      .join('')
  }
  return String(msg.content ?? '')
}

// ---------------------------------------------------------------------------
// Agent-level assertions (tag-based — matches sanitizeMessages output)
// ---------------------------------------------------------------------------

/**
 * Assert that all assistant messages are from the expected agents only.
 * Matches against `<AGENT>Name</AGENT>` tags in message text.
 */
export function expectMessagesFromAgents(messages: any[], expectedAgentNames: string[]) {
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  for (const msg of assistantMessages) {
    const text = getMessageText(msg)
    const agentTagMatch = text.match(/<AGENT>(.*?)<\/AGENT>/)
    if (agentTagMatch) {
      expect(expectedAgentNames).toContain(agentTagMatch[1])
    }
  }
}

/**
 * Assert that NO assistant messages are from the given agent.
 */
export function expectNoMessagesFromAgent(messages: any[], agentName: string) {
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  for (const msg of assistantMessages) {
    const text = getMessageText(msg)
    const agentTagMatch = text.match(/<AGENT>(.*?)<\/AGENT>/)
    if (agentTagMatch) {
      expect(agentTagMatch[1]).not.toBe(agentName)
    }
  }
}

// ---------------------------------------------------------------------------
// Agent-level assertions (metadata-based — matches ChatMessage.metadata.agentId)
// ---------------------------------------------------------------------------

/**
 * Assert that messages contain at least one message from each of the
 * specified agent IDs (by metadata.agentId).
 */
export function expectMessagesFromAgentIds(messages: any[], expectedAgentIds: string[]) {
  const agentIds = new Set(
    messages
      .filter((m: any) => m.metadata?.agentId)
      .map((m: any) => m.metadata.agentId)
  )
  for (const expected of expectedAgentIds) {
    expect(agentIds).toContain(expected)
  }
}

/**
 * Assert that messages contain ONLY messages from the specified agent IDs
 * (no other agents present).
 */
export function expectMessagesOnlyFromAgentIds(messages: any[], allowedAgentIds: string[]) {
  const allowedSet = new Set(allowedAgentIds)
  const assistantMessages = messages.filter((m: any) => m.role === 'assistant' && m.metadata?.agentId)
  for (const msg of assistantMessages) {
    expect(allowedSet).toContain(msg.metadata.agentId)
  }
}

/**
 * Assert that NO messages come from the specified agent ID.
 */
export function expectNoMessagesFromAgentId(messages: any[], agentId: string) {
  const fromAgent = messages.filter((m: any) => m.metadata?.agentId === agentId)
  expect(fromAgent).toHaveLength(0)
}

// ---------------------------------------------------------------------------
// Count assertions
// ---------------------------------------------------------------------------

/**
 * Assert the total number of messages.
 */
export function expectMessageCount(messages: any[], count: number) {
  expect(messages).toHaveLength(count)
}

/**
 * Assert the number of assistant (agent) messages.
 */
export function expectAssistantMessageCount(messages: any[], count: number) {
  const assistant = messages.filter((m: any) => m.role === 'assistant')
  expect(assistant).toHaveLength(count)
}

/**
 * Assert the number of user messages.
 */
export function expectUserMessageCount(messages: any[], count: number) {
  const user = messages.filter((m: any) => m.role === 'user')
  expect(user).toHaveLength(count)
}

// ---------------------------------------------------------------------------
// Session-level assertions
// ---------------------------------------------------------------------------

/**
 * Assert that all messages in the list belong to the specified session.
 */
export function expectAllMessagesInSession(messages: any[], sessionId: string) {
  for (const msg of messages) {
    expect(msg.metadata?.sessionId).toBe(sessionId)
  }
}

/**
 * Assert that messages span exactly the given set of session IDs.
 */
export function expectSessionIds(messages: any[], expectedSessionIds: string[]) {
  const sessionIds = new Set(
    messages
      .filter((m: any) => m.metadata?.sessionId)
      .map((m: any) => m.metadata.sessionId)
  )
  expect([...sessionIds].sort()).toEqual([...expectedSessionIds].sort())
}

// ---------------------------------------------------------------------------
// Content assertions
// ---------------------------------------------------------------------------

/**
 * Assert that no message text contains the given pattern.
 */
export function expectNoMessageContaining(messages: any[], pattern: RegExp) {
  for (const msg of messages) {
    const text = getMessageText(msg)
    expect(text).not.toMatch(pattern)
  }
}

/**
 * Assert that at least one message contains the given pattern.
 */
export function expectSomeMessageContaining(messages: any[], pattern: RegExp) {
  const texts = messages.map(getMessageText)
  expect(texts.some(t => pattern.test(t))).toBe(true)
}

// ---------------------------------------------------------------------------
// Progress assertions
// ---------------------------------------------------------------------------

/**
 * Assert that progress reflects the expected active round.
 */
export function expectActiveRound(progress: any, roundId: string) {
  expect(progress.active.round.id).toBe(roundId)
}

/**
 * Assert that progress reflects the expected active agent.
 */
export function expectActiveAgent(progress: any, agentId: string) {
  expect(progress.active.agent.id).toBe(agentId)
}

/**
 * Assert that progress shows the round as complete.
 */
export function expectRoundComplete(progress: any) {
  expect(progress.active.round.isComplete).toBe(true)
}

/**
 * Assert that progress shows the round as NOT complete.
 */
export function expectRoundNotComplete(progress: any) {
  expect(progress.active.round.isComplete).toBe(false)
}
