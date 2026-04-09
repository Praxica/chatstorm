import { prisma } from '@/lib/prisma'
import { CHAT_USER_CONTINUE } from '@/lib/constants'
import { uiMessageToPlainText } from '@/lib/utils/uiMessage'

export type TranscriptMessage = {
  id: string
  timestamp: Date
  role: string
  agent: string
  agentId: string | null
  model: string
  roundId: string | null
  roundName: string
  content: string
}

export type ChatMeta = {
  id: string
  title: string
  configId: string
  configTitle: string
  createdAt: Date
  updatedAt: Date
}

export type TranscriptResult = {
  content: string
  contentType: string
  filename: string
}

/**
 * Fetches chat data and generates transcript message objects.
 * Returns null if chat not found.
 */
export async function generateTranscriptData(
  chatId: string,
  configId: string,
  userId: string
): Promise<{ messages: TranscriptMessage[]; chat: ChatMeta } | null> {
  const chat = await prisma.chat.findUnique({
    where: {
      id: chatId,
      configId: configId,
      userId: userId
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        where: { isActive: true }
      },
      config: {
        select: {
          id: true,
          title: true
        }
      }
    }
  })

  if (!chat) return null

  const rounds = await prisma.chatRound.findMany({
    where: { configId: configId },
    select: {
      id: true,
      name: true,
      sequence: true,
      moderatorAgentId: true,
      lengthModerator: true
    }
  })

  const messageAgentIds = [...new Set(
    chat.messages
      .map(msg => msg.agentId)
      .filter((id): id is string => !!id)
  )]

  const roundIds = rounds.map(round => round.id)
  const moderatorAgentIds = rounds
    .filter(round => round.moderatorAgentId)
    .map(round => round.moderatorAgentId)
  const lengthModeratorAgentIds = rounds
    .filter(round => round.lengthModerator)
    .map(round => round.lengthModerator)
  const allModeratorIds = [...new Set([
    ...moderatorAgentIds.filter((id): id is string => !!id),
    ...lengthModeratorAgentIds.filter((id): id is string => !!id)
  ])]

  const agents = await prisma.chatAgent.findMany({
    where: {
      OR: [
        { id: { in: messageAgentIds } },
        { rounds: { some: { id: { in: roundIds } } } },
        { id: { in: allModeratorIds } }
      ]
    },
    select: {
      id: true,
      name: true
    }
  })

  const messages = chat.messages
    .filter(message => {
      if (message.role === 'user') {
        const textContent = typeof message.content === 'string'
          ? message.content
          : uiMessageToPlainText(message.content as any)
        if (textContent === CHAT_USER_CONTINUE) {
          return false
        }
      }
      return true
    })
    .map(message => {
      const metadata = message.metadata as any || {}

      let agentName = 'Unknown'
      if (message.role === 'user') {
        agentName = 'User'
      } else if (message.role === 'system') {
        agentName = 'System'
      } else if (message.agentId) {
        const agent = agents.find(a => a.id === message.agentId)
        agentName = agent?.name || `Unknown Agent (${message.agentId})`
      }

      const model = metadata.model || 'Unknown'
      const roundId = metadata.roundId
      let roundName = 'Unknown'
      if (roundId) {
        const round = rounds.find(r => r.id === roundId)
        roundName = round?.name || `Round ${round?.sequence || 'Unknown'}`
      }

      return {
        id: message.id,
        timestamp: message.createdAt,
        role: message.role,
        agent: agentName,
        agentId: message.agentId,
        model: model,
        roundId: roundId,
        roundName: roundName,
        content: typeof message.content === 'string' ? message.content : uiMessageToPlainText(message.content as any)
      }
    })

  return {
    messages,
    chat: {
      id: chat.id,
      title: chat.title,
      configId: chat.configId,
      configTitle: chat.config?.title || 'Unknown',
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }
  }
}

/**
 * Formats transcript data into the requested format (text, json, csv).
 */
export function formatTranscript(
  transcriptData: TranscriptMessage[],
  chatMeta: ChatMeta,
  format: string,
  forceDownload: boolean = false
): TranscriptResult {
  const safeTitle = chatMeta.title.replace(/[^a-zA-Z0-9]/g, '_')

  switch (format) {
    case 'json': {
      const content = JSON.stringify({
        chat: {
          id: chatMeta.id,
          title: chatMeta.title,
          configId: chatMeta.configId,
          configTitle: chatMeta.configTitle,
          createdAt: chatMeta.createdAt,
          updatedAt: chatMeta.updatedAt
        },
        messages: transcriptData
      }, null, 2)
      return {
        content,
        contentType: 'application/json',
        filename: `transcript_${chatMeta.id}_${safeTitle}.json`
      }
    }

    case 'csv': {
      const csvHeaders = ['Timestamp', 'Role', 'Agent', 'Model', 'Round', 'Content']
      const csvRows = transcriptData.map(msg => [
        msg.timestamp.toISOString(),
        msg.role,
        msg.agent,
        msg.model,
        msg.roundName,
        `"${msg.content.replace(/"/g, '""')}"`
      ])
      return {
        content: [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n'),
        contentType: forceDownload ? 'text/csv' : 'text/plain',
        filename: `transcript_${chatMeta.id}_${safeTitle}.csv`
      }
    }

    case 'text':
    default: {
      const textLines = [
        `Chat Transcript: ${chatMeta.title}`,
        `Chat Design: ${chatMeta.configTitle}`,
        `Generated: ${new Date().toISOString()}`,
        '=' + '='.repeat(60),
        ''
      ]

      transcriptData.forEach((msg) => {
        if (msg.roundName !== 'Unknown') {
          textLines.push(`Round: ${msg.roundName}`)
        }
        if (msg.model !== 'Unknown') {
          textLines.push(`Model: ${msg.model}`)
        }
        const readableTime = new Date(msg.timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short'
        })
        textLines.push(`${msg.timestamp.toISOString()} - ${readableTime}`)
        textLines.push('')
        textLines.push(`${msg.agent} (${msg.role}):`)
        textLines.push('')
        textLines.push(msg.content)
        textLines.push('')
        textLines.push('-'.repeat(60))
        textLines.push('')
      })

      return {
        content: textLines.join('\n'),
        contentType: 'text/plain',
        filename: `transcript_${chatMeta.id}_${safeTitle}.txt`
      }
    }
  }
}
