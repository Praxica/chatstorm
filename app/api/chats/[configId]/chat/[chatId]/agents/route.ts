import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { AgentService } from '@/lib/chat/services/agents'

// GET /api/chats/[configId]/chat/[chatId]/agents - Get all agents for a specific chat
export async function GET(
  req: Request,
  { params }: { params: Promise<{ configId: string, chatId: string }> }
) {
  try {
    const { chatId, configId } = await params
    console.log(`API: Loading agents for chat ${chatId} (config ${configId})`)
    const userId = await getAuthenticatedUserId()
    console.log(`API: Authenticated user ID: ${userId}`)

    // First check if the user directly owns the chat
    let chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        configId: configId,
        userId: userId
      },
      include: {
        config: {
          include: {
            rounds: true
          }
        }
      }
    })
    
    // If the user doesn't own the chat, let's check if they have access via a shared copy
    if (!chat) {
      console.log(`API: User doesn't own chat directly, checking for shared access`)
      
      // Look for the chat with no specific user restrictions
      const rawChat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          configId: configId
        },
        include: {
          shares: true,
          config: {
            include: {
              rounds: true
            }
          }
        }
      })
      
      if (rawChat) {
        console.log(`API: Found chat: ${rawChat.id}, config: ${rawChat.configId}`)
        
        // Check if this chat has been shared publicly
        const hasActiveShare = rawChat.shares.some(share => share.isActive === true);
        
        if (hasActiveShare) {
          console.log(`API: Chat has an active share, granting access`);
          chat = rawChat;
        } else {
          console.log(`API: Chat found but has no active shares, denying access`);
        }
      } else {
        console.log(`API: Chat not found at all with ID: ${chatId}`)
      }
    }

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or you do not have access to it' },
        { status: 404 }
      )
    }

    // Use the existing function to get all agents for this chat's rounds
    console.log(`API: Getting agents for ${chat.config.rounds.length} rounds`)
    const selectedAgents = await AgentService.getAllAgentsInRounds(chat.config.rounds)
    console.log(`API: Found ${selectedAgents.length} selected agents for chat`)

    // Also get dynamic agents from ALL sessions for this chat
    let dynamicAgents: any[] = []
    try {
      console.log(`API: Looking for all sessions for chat ${chatId}`)
      
      // Get all sessions for this chat, not just the latest one
      const allSessions = await prisma.chatRoundSession.findMany({
        where: {
          chatId: chatId
        },
        orderBy: {
          startedAt: 'asc'
        }
      })

      console.log(`API: Found ${allSessions.length} sessions for chat ${chatId}`)
      allSessions.forEach((session, i) => {
        console.log(`API:   Session ${i + 1}: ${session.id} (round: ${session.roundId}, started: ${session.startedAt})`)
      })

      if (allSessions.length > 0) {
        console.log(`API: Fetching dynamic agents from all sessions`)
        
        try {
          // Get dynamic agents from ALL sessions, not just the latest
          const allDynamicAgents = await prisma.chatAgent.findMany({
            where: {
              chatRoundSessionId: {
                in: allSessions.map(s => s.id)
              },
              isDynamic: true
            }
          })
          
          dynamicAgents = allDynamicAgents
          console.log(`API: Found ${dynamicAgents.length} total dynamic agents across all sessions`)
          if (dynamicAgents.length > 0) {
            console.log(`API: Dynamic agents:`, dynamicAgents.map(a => ({ 
              id: a.id, 
              name: a.name, 
              isDynamic: a.isDynamic,
              sessionId: a.chatRoundSessionId
            })))
          }
        } catch (serviceError) {
          console.error('API: Error fetching dynamic agents:', serviceError instanceof Error ? serviceError.message : String(serviceError))
          console.error('API: Full service error:', serviceError)
        }
      } else {
        console.log(`API: No sessions found for chat ${chatId}`)
      }
    } catch (error) {
      console.error('API: Error in dynamic agents section:', error instanceof Error ? error.message : String(error))
      if (error instanceof Error) {
        console.error('API: Error stack:', error.stack)
      }
      // Continue without dynamic agents
    }

    // Combine selected and dynamic agents
    const allAgents = [...selectedAgents, ...dynamicAgents]
    console.log(`API: Returning ${allAgents.length} total agents (${selectedAgents.length} selected + ${dynamicAgents.length} dynamic)`)

    return NextResponse.json(allAgents)
  } catch (error) {
    console.error('GET /api/chats/[configId]/chat/[chatId]/agents error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch agents for chat' },
      { status: 500 }
    )
  }
} 