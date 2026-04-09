import { formatTranscript, TranscriptMessage, ChatMeta } from '@/lib/utils/transcript'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chatMeta: ChatMeta = {
  id: 'chat-123',
  title: 'Test Chat',
  configId: 'config-456',
  configTitle: 'My Config',
  createdAt: new Date('2025-01-15T10:00:00Z'),
  updatedAt: new Date('2025-01-15T11:00:00Z'),
}

const messages: TranscriptMessage[] = [
  {
    id: 'msg-1',
    timestamp: new Date('2025-01-15T10:01:00Z'),
    role: 'user',
    agent: 'User',
    agentId: null,
    model: 'Unknown',
    roundId: 'round-1',
    roundName: 'Introduction',
    content: 'Hello, can you help me?',
  },
  {
    id: 'msg-2',
    timestamp: new Date('2025-01-15T10:02:00Z'),
    role: 'assistant',
    agent: 'Researcher',
    agentId: 'agent-1',
    model: 'claude-sonnet-4-20250514',
    roundId: 'round-1',
    roundName: 'Introduction',
    content: 'Of course! What do you need?',
  },
]

// ---------------------------------------------------------------------------
// Text format
// ---------------------------------------------------------------------------

describe('formatTranscript — text', () => {
  it('includes chat title and config title in header', () => {
    const { content } = formatTranscript(messages, chatMeta, 'text')
    expect(content).toContain('Chat Transcript: Test Chat')
    expect(content).toContain('Chat Design: My Config')
  })

  it('includes round name and model for each message', () => {
    const { content } = formatTranscript(messages, chatMeta, 'text')
    expect(content).toContain('Round: Introduction')
    expect(content).toContain('Model: claude-sonnet-4-20250514')
  })

  it('includes agent name with role', () => {
    const { content } = formatTranscript(messages, chatMeta, 'text')
    expect(content).toContain('User (user):')
    expect(content).toContain('Researcher (assistant):')
  })

  it('omits model line when model is Unknown', () => {
    const { content } = formatTranscript(messages, chatMeta, 'text')
    const lines = content.split('\n')
    // The user message has model "Unknown" — no "Model: Unknown" line should appear before it
    const userMsgIndex = lines.findIndex(l => l.includes('User (user):'))
    const precedingLines = lines.slice(Math.max(0, userMsgIndex - 4), userMsgIndex)
    expect(precedingLines.some(l => l.startsWith('Model:'))).toBe(false)
  })

  it('returns correct contentType and filename', () => {
    const result = formatTranscript(messages, chatMeta, 'text')
    expect(result.contentType).toBe('text/plain')
    expect(result.filename).toBe('transcript_chat-123_Test_Chat.txt')
  })
})

// ---------------------------------------------------------------------------
// JSON format
// ---------------------------------------------------------------------------

describe('formatTranscript — json', () => {
  it('produces valid JSON with chat metadata and messages', () => {
    const { content } = formatTranscript(messages, chatMeta, 'json')
    const parsed = JSON.parse(content)
    expect(parsed.chat.id).toBe('chat-123')
    expect(parsed.chat.title).toBe('Test Chat')
    expect(parsed.chat.configTitle).toBe('My Config')
    expect(parsed.messages).toHaveLength(2)
  })

  it('preserves message fields', () => {
    const { content } = formatTranscript(messages, chatMeta, 'json')
    const parsed = JSON.parse(content)
    const msg = parsed.messages[1]
    expect(msg.agent).toBe('Researcher')
    expect(msg.model).toBe('claude-sonnet-4-20250514')
    expect(msg.roundName).toBe('Introduction')
    expect(msg.content).toBe('Of course! What do you need?')
  })

  it('returns correct contentType and filename', () => {
    const result = formatTranscript(messages, chatMeta, 'json')
    expect(result.contentType).toBe('application/json')
    expect(result.filename).toBe('transcript_chat-123_Test_Chat.json')
  })
})

// ---------------------------------------------------------------------------
// CSV format
// ---------------------------------------------------------------------------

describe('formatTranscript — csv', () => {
  it('includes header row with correct columns', () => {
    const { content } = formatTranscript(messages, chatMeta, 'csv')
    const firstLine = content.split('\n')[0]
    expect(firstLine).toBe('Timestamp,Role,Agent,Model,Round,Content')
  })

  it('has one data row per message', () => {
    const { content } = formatTranscript(messages, chatMeta, 'csv')
    const lines = content.split('\n')
    // 1 header + 2 data rows
    expect(lines).toHaveLength(3)
  })

  it('escapes double quotes in content', () => {
    const msgWithQuotes: TranscriptMessage[] = [{
      ...messages[0],
      content: 'She said "hello" to them',
    }]
    const { content } = formatTranscript(msgWithQuotes, chatMeta, 'csv')
    // Content field should have doubled quotes
    expect(content).toContain('She said ""hello"" to them')
  })

  it('uses text/csv contentType when forceDownload is true', () => {
    const result = formatTranscript(messages, chatMeta, 'csv', true)
    expect(result.contentType).toBe('text/csv')
  })

  it('uses text/plain contentType when forceDownload is false', () => {
    const result = formatTranscript(messages, chatMeta, 'csv', false)
    expect(result.contentType).toBe('text/plain')
  })

  it('returns correct filename', () => {
    const result = formatTranscript(messages, chatMeta, 'csv')
    expect(result.filename).toBe('transcript_chat-123_Test_Chat.csv')
  })
})

// ---------------------------------------------------------------------------
// Filename sanitization
// ---------------------------------------------------------------------------

describe('formatTranscript — filename', () => {
  it('strips special characters from title in filename', () => {
    const meta: ChatMeta = { ...chatMeta, title: 'My Chat! @#$%' }
    const { filename } = formatTranscript(messages, meta, 'text')
    expect(filename).toBe('transcript_chat-123_My_Chat______.txt')
    expect(filename).not.toMatch(/[!@#$%]/)
  })
})

// ---------------------------------------------------------------------------
// Default/fallback
// ---------------------------------------------------------------------------

describe('formatTranscript — default format', () => {
  it('falls back to text format for unknown format string', () => {
    const result = formatTranscript(messages, chatMeta, 'xml')
    expect(result.contentType).toBe('text/plain')
    expect(result.filename.endsWith('.txt')).toBe(true)
    expect(result.content).toContain('Chat Transcript:')
  })
})
