import { prisma } from '@/lib/prisma';
import { ChatState } from '../types';
import { MessageUtils } from './messages';
import { SummaryData } from './retention-types';

export interface ChatRoundSessionData {
  id: string;
  chatId: string;
  roundId: string;
  startedAt: Date;
  completedAt: Date | null;
  isActive: boolean;
  compressionData: any | null;
  compressionVersion: string | null;
  compressedAt: Date | null;
}

export class ChatRoundSessionService {
  /**
   * Get the active session for a chat and round, or null if none exists
   */
  static async getActiveSession(chatId: string, roundId: string): Promise<ChatRoundSessionData | null> {
    const session = await prisma.chatRoundSession.findFirst({
      where: {
        chatId,
        roundId,
        isActive: true
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    return session;
  }

  /**
   * Get or create an active session for a chat and round
   * This is the main entry point for ensuring a session exists
   */
  static async getOrCreateSession(chatId: string, roundId: string, allSessions?: ChatRoundSessionData[]): Promise<ChatRoundSessionData> {
    if (allSessions) {
      // Find the most recent active session for the given round from the pre-loaded list.
      const activeSession = [...allSessions]
          .reverse()
          .find(s => s.roundId === roundId && s.isActive);
      if (activeSession) {
          return activeSession;
      }
      // If not found in the pre-loaded sessions, it needs to be created.
      return await this.createSession(chatId, roundId);
    }

    // --- Legacy path if allSessions is not provided ---
    // First try to find an active session via DB
    const existingSession = await this.getActiveSession(chatId, roundId);
    if (existingSession) {
        return existingSession;
    }

    // No active session found, create a new one
    return await this.createSession(chatId, roundId);
  }

  /**
   * Assigns the initial user message of a chat to a session.
   * This is necessary because the first message is created before the first session exists.
   * It finds the first message, and updates it with the session ID and the round ID in its metadata.
   */
  static async assignInitialMessageToSession(chatState: ChatState, session: ChatRoundSessionData): Promise<void> {
    const initialMessageFromDb = await prisma.message.findFirst({
      where: { chatId: chatState.chat.id },
      orderBy: { createdAt: 'asc' },
    });

    if (initialMessageFromDb && !initialMessageFromDb.chatRoundSessionId) {
      const newMetadata = {
        ...((initialMessageFromDb.metadata as object) || {}),
        roundId: chatState.activeRound.id,
      };

      const updatedMessage = await prisma.message.update({
        where: { id: initialMessageFromDb.id },
        data: {
          chatRoundSessionId: session.id,
          metadata: newMetadata,
        },
      });
      // This is a critical step: we must refresh the message in the current chat state
      // so that downstream services like compression have the correct data.
      chatState.messages[0] = MessageUtils.convertDatabaseMessage(updatedMessage);
    }
  }

  /**
   * Create a new session for a chat and round
   */
  static async createSession(chatId: string, roundId: string): Promise<ChatRoundSessionData> {
    const session = await prisma.chatRoundSession.create({
      data: {
        chatId,
        roundId,
        isActive: true
      }
    });

    console.log(`Created new ChatRoundSession: ${session.id} for chat:${chatId}, round:${roundId}`);
    return session;
  }

  /**
   * Close a session by setting isActive to false and completedAt timestamp
   */
  static async closeSession(sessionId: string): Promise<void> {
    console.log(`Attempting to close ChatRoundSession: ${sessionId}`);
    if (!sessionId) {
      console.error('closeSession called with null or undefined sessionId');
      return;
    }
    
    try {
    await prisma.chatRoundSession.update({
      where: {
        id: sessionId
      },
      data: {
        isActive: false,
        completedAt: new Date()
      }
    });
      console.log(`Successfully closed ChatRoundSession: ${sessionId}`);
    } catch (error) {
      console.error(`Error closing ChatRoundSession ${sessionId}:`, error);
      // Decide if you want to re-throw the error or handle it gracefully
      // For now, we'll just log it to prevent crashing the onComplete flow
    }
  }

  /**
   * Close all active sessions for a given chat and round
   * Useful for ensuring clean state transitions
   */
  static async closeActiveSessions(chatId: string, roundId: string): Promise<void> {
    await prisma.chatRoundSession.updateMany({
      where: {
        chatId,
        roundId,
        isActive: true
      },
      data: {
        isActive: false,
        completedAt: new Date()
      }
    });

    console.log(`Closed all active sessions for chat:${chatId}, round:${roundId}`);
  }

  /**
   * Get all sessions for a chat (for debugging/admin purposes)
   */
  static async getChatSessions(chatId: string): Promise<ChatRoundSessionData[]> {
    console.log(`[SESSIONS] Loading all sessions for chat: ${chatId}`);
    
    const sessions = await prisma.chatRoundSession.findMany({
      where: {
        chatId
      },
      orderBy: {
        startedAt: 'asc'
      }
    });
    
    console.log(`[SESSIONS] Found ${sessions.length} sessions`);
    const activeSessions = sessions.filter(s => s.isActive).length;
    const compressedSessions = sessions.filter(s => s.compressionData).length;
    console.log(`[SESSIONS] - Active: ${activeSessions}, Compressed: ${compressedSessions}`);
    
    return sessions;
  }

  /**
   * Update session with compression data
   */
  static async setCompression(
    sessionId: string, 
    compressionData: any,
    version: string = 'v1'
  ): Promise<void> {
    await prisma.chatRoundSession.update({
      where: {
        id: sessionId
      },
      data: {
        compressionData,
        compressionVersion: version,
        compressedAt: new Date()
      }
    });

    console.log(`Added compression to ChatRoundSession: ${sessionId}`);
  }

  /**
   * Update session with summary data
   */
  static async setSummaryData(
    sessionId: string, 
    summaryData: SummaryData
  ): Promise<void> {
    await this.setCompression(sessionId, summaryData, 'v2');
    console.log(`Added summary data to ChatRoundSession: ${sessionId}`);
  }

  /**
   * Check if a session has compression data
   */
  static async hasCompression(sessionId: string): Promise<boolean> {
    const session = await prisma.chatRoundSession.findUnique({
      where: {
        id: sessionId
      },
      select: {
        compressionData: true
      }
    });

    return session?.compressionData !== null;
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string): Promise<ChatRoundSessionData | null> {
    return await prisma.chatRoundSession.findUnique({
      where: {
        id: sessionId
      }
    });
  }

  /**
   * Reactivate an existing session for replay
   */
  static async replayExistingSession(chatId: string, roundId: string): Promise<string | null> {
    const existingSession = await prisma.chatRoundSession.findFirst({
      where: {
        chatId,
        roundId
      },
      orderBy: { startedAt: 'desc' }
    });
    
    if (existingSession) {
      // Reactivate the session for replay
      await prisma.chatRoundSession.update({
        where: { id: existingSession.id },
        data: { 
          isActive: true,
          completedAt: null
        }
      });
      
      console.log(`[REPLAY] Reactivated session ${existingSession.id} for round ${roundId}`);
      return existingSession.id;
    }
    
    console.log(`[REPLAY] No existing session found for round ${roundId}, will create new one`);
    return null;
  }

  /**
   * Initialize session for a chat state - handles session creation and assignment
   * This consolidates the session logic from ChatEngine.initialize
   */
  static async initializeSession(chatState: ChatState): Promise<ChatState> {
    // Only handle sessions for persisted chats
    if (chatState.chat.persistenceMode !== 'save') {
      return chatState;
    }

    let session: ChatRoundSessionData | undefined;
    let isNewSession = false;
    
    // Check if currentSessionId is already set (e.g., from replay logic)
    if (chatState.currentSessionId) {
      // Find the session object for the existing ID
      session = chatState.sessions.find(s => s.id === chatState.currentSessionId);
      if (!session) {
        // Session ID was set but not in sessions list - fetch it from database
        const sessionData = await this.getSessionById(chatState.currentSessionId);
        if (sessionData) {
          session = sessionData;
          chatState.sessions.push(session);
          isNewSession = true; // New to the sessions list, but not newly created
        }
      }

      // If session exists but is not active, reactivate it (replay scenario)
      if (session && !session.isActive) {
        await prisma.chatRoundSession.update({
          where: { id: session.id },
          data: {
            isActive: true,
            completedAt: null
          }
        });
        // Update the in-memory session object
        session.isActive = true;
        session.completedAt = null;
      }
    }

    if (!session) {
      session = await this.getOrCreateSession(
        chatState.chat.id,
        chatState.activeRound.id,
        chatState.sessions
      );
      isNewSession = !chatState.sessions.find(s => s.id === session!.id);
    }

    // if a new session was created, add it to our list
    if (isNewSession && !chatState.sessions.find(s => s.id === session.id)) {
      chatState.sessions.push(session);
    }

    chatState.currentSessionId = session.id;

    // Assign the initial message to the new session if needed
    if (
      chatState.messages.length === 1 &&
      chatState.messages[0].role === 'user'
    ) {
      await this.assignInitialMessageToSession(chatState, session);
    }

    return chatState;
  }
} 