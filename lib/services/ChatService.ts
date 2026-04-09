import { prisma } from '@/lib/prisma';
import { createInitialProgress } from '@/lib/chat/services/progress';
import { BranchType, ChatOriginType } from '@prisma/client';
import { ChatRoundSessionService } from '@/lib/chat/services/sessions';
import { MessageService } from './MessageService';

interface CreateChatParams {
  configId: string;
  userId: string;
  title?: string;
  initialMessage?: string;
  originType?: ChatOriginType;
  isPreview?: boolean;
  sourceChatId?: string;
}

/**
 * Creates a new Chat, an initial Branch, and optionally the first user Message.
 * Runs all operations within a single transaction.
 * @returns The newly created Chat object, including its ID and initial activeBranch ID.
 */
async function createInitialChatInternal(params: CreateChatParams) {
  const {
    configId,
    userId,
    title,
    initialMessage,
    originType = 'chat',
    isPreview = false,
    sourceChatId = null
  } = params;


  try {
    // 1. Create the chat, use 'New Chat' as fallback if no title provided
    const newChat = await prisma.chat.create({
      data: {
        title: title || 'New Chat', // Use 'New Chat' as default
        configId,
        userId,
        activeBranchPath: [], // Initialize empty, will be updated
        originType,
        isPreview,
        sourceChatId,
      },
    });

    // 2. Create the main/origin branch for the chat
    const newBranch = await prisma.branch.create({
      data: {
        chatId: newChat.id,
        name: 'origin', // Use 'origin' as the initial branch name/type
        type: BranchType.origin, 
      },
    });

    // 3. Update the chat with active branch info
    await prisma.chat.update({
      where: { id: newChat.id },
      data: {
        activeBranch: newBranch.id,
        activeBranchPath: [newBranch.id],
      },
    });

    // 4. Create the initial message if provided
    if (initialMessage && typeof initialMessage === 'string' && initialMessage.trim()) {
      
      // Fetch the first round ID for metadata
      const firstRound = await prisma.chatRound.findFirst({
        where: { configId },
        orderBy: { sequence: 'asc' },
        select: { id: true }
      });

      if (!firstRound) {
        throw new Error('Cannot create initial message: No rounds configured.');
      }

      const initialRoundId = firstRound.id;
      const initialProgress = createInitialProgress(initialRoundId);
      
      // Create a session for the first round
      const initialSession = await ChatRoundSessionService.createSession(newChat.id, initialRoundId);

      await prisma.message.create({
        data: {
          chatId: newChat.id,
          branchId: newBranch.id,
          role: 'user',
          content: { role: 'user', parts: [{ type: 'text', text: initialMessage.trim() }] } as any,
          createdAt: new Date(),
          isActive: true,
          branchPath: [newBranch.id], 
          chatRoundSessionId: initialSession.id, // Assign to session
          metadata: {
            roundId: initialRoundId,
            progress: JSON.parse(JSON.stringify(initialProgress)) // Ensure valid JSON
          },
          annotations: [],
        },
      });
    }
    
    const finalChat = await prisma.chat.findUniqueOrThrow({ where: { id: newChat.id } });
    return finalChat;
  } catch (error) {
    console.error('[ChatService] Error creating chat:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Copy messages from one chat to another
 * Extracted from share copy route for reusability
 */
async function copyMessagesToChat(
  targetChatId: string,
  targetBranchId: string,
  messages: any[]
) {

  const messagePromises = messages.map((message) => {
    // Safely extract string content from the JSON
    let contentStr;
    try {
      contentStr = JSON.stringify(message.content);
    } catch (_e) {
      contentStr = '{}';
    }

    return prisma.message.create({
      data: {
        chatId: targetChatId,
        branchId: targetBranchId,
        role: message.role,
        content: JSON.parse(contentStr), // Parse back to object
        createdAt: new Date(message.createdAt), // Preserve original timestamp
        agentId: message.agentId, // Preserve original agentId
        isActive: true,
        branchPath: [targetBranchId],
        annotations: message.annotations as any,
        metadata: message.metadata as any,
        chatRoundSessionId: message.chatRoundSessionId, // Preserve session for reconstruction
      },
    });
  });

  await Promise.all(messagePromises);
}

/**
 * Copy a chat to a new chat, optionally with a subset of messages
 */
async function copyChat(options: {
  sourceChatId: string;
  targetUserId: string;
  targetConfigId?: string;
  title?: string;
  originType?: ChatOriginType;
  isPreview?: boolean;
  includeMessagesUpTo?: string; // messageId limit (for shares)
}) {
  const {
    sourceChatId,
    targetUserId,
    targetConfigId,
    title,
    originType = 'copy',
    isPreview = false,
    includeMessagesUpTo
  } = options;


  // Get source chat with messages
  const sourceChat = await prisma.chat.findUnique({
    where: { id: sourceChatId },
    include: {
      messages: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!sourceChat) {
    throw new Error('Source chat not found');
  }

  // Filter messages if limit specified (for share copies)
  let messagesToCopy = sourceChat.messages;
  if (includeMessagesUpTo) {
    const limitIndex = messagesToCopy.findIndex(m => m.id === includeMessagesUpTo);
    if (limitIndex >= 0) {
      messagesToCopy = messagesToCopy.slice(0, limitIndex + 1);
    }
  }

  // Create new chat using existing createInitialChat (DRY!)
  const newChat = await createInitialChatInternal({
    configId: targetConfigId || sourceChat.configId,
    userId: targetUserId,
    title: title || `Copy of ${sourceChat.title}`,
    originType,
    isPreview,
    sourceChatId,
    // Don't pass initialMessage - we'll copy messages separately
  });

  // Copy messages if any exist
  if (messagesToCopy.length > 0) {
    await copyMessagesToChat(newChat.id, newChat.activeBranch!, messagesToCopy);
  }

  return newChat;
}

/**
 * Get or create the preview chat for a config
 * Each config has exactly one preview chat
 */
async function getOrCreatePreviewChat(configId: string, userId: string) {

  // Check if config already has a preview chat
  const config = await prisma.config.findUnique({
    where: { id: configId, userId },
    select: { previewChatId: true, title: true }
  });

  if (!config) {
    throw new Error('Config not found or unauthorized');
  }

  // If preview chat exists, return it
  if (config.previewChatId) {
    const existingPreview = await prisma.chat.findUnique({
      where: { id: config.previewChatId }
    });

    if (existingPreview) {
      return existingPreview;
    }
  }

  // Create new preview chat
  const previewChat = await createInitialChatInternal({
    configId,
    userId,
    title: `Preview: ${config.title}`,
    originType: 'chat',
    isPreview: true
  });

  // Link to config
  await prisma.config.update({
    where: { id: configId },
    data: { previewChatId: previewChat.id }
  });

  return previewChat;
}

/**
 * Copy a live or batch chat to the preview workspace
 */
async function copyToPreview(sourceChatId: string, userId: string) {

  // Get source chat to determine config
  const sourceChat = await prisma.chat.findUnique({
    where: { id: sourceChatId },
    select: { configId: true, userId: true, title: true, originType: true }
  });

  if (!sourceChat) {
    throw new Error('Source chat not found');
  }

  // Auth: User must own the config
  const config = await prisma.config.findUnique({
    where: { id: sourceChat.configId, userId }
  });

  if (!config) {
    throw new Error('Unauthorized: You must own the config to copy to preview');
  }

  // Get or create preview chat for this config
  let previewChat = await getOrCreatePreviewChat(sourceChat.configId, userId);

  // Check if preview already has messages
  const existingMessageCount = await prisma.message.count({
    where: { chatId: previewChat.id, isActive: true }
  });

  if (existingMessageCount > 0) {

    // Create new preview chat (old one becomes orphaned)
    previewChat = await createInitialChatInternal({
      configId: sourceChat.configId,
      userId,
      title: `Preview: Copy of ${sourceChat.title}`,
      originType: 'copy',
      isPreview: true,
      sourceChatId
    });

    // Update config to point to new preview
    await prisma.config.update({
      where: { id: sourceChat.configId },
      data: { previewChatId: previewChat.id }
    });
  } else {
    // Preview is empty, update its metadata
    await prisma.chat.update({
      where: { id: previewChat.id },
      data: {
        title: `Preview: Copy of ${sourceChat.title}`,
        originType: 'copy',
        sourceChatId
      }
    });
  }

  // Copy all messages
  const sourceMessages = await prisma.message.findMany({
    where: { chatId: sourceChatId, isActive: true },
    orderBy: { createdAt: 'asc' }
  });

  if (sourceMessages.length > 0) {
    await copyMessagesToChat(
      previewChat.id,
      previewChat.activeBranch!,
      sourceMessages
    );
  }

  return previewChat;
}

/**
 * Get chat with normalized messages
 */
async function getChatWithNormalizedMessages(configId: string, chatId: string, userId: string) {
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
      }
    }
  })

  if (!chat) {
    return null;
  }

  // Normalize messages
  const normalizedMessages = MessageService.normalizeMessages(chat.messages);

  // Get any dynamic agents created during this chat
  const dynamicAgents = await prisma.chatAgent.findMany({
    where: {
      isDynamic: true,
      chatRoundSession: {
        chatId: chatId
      }
    }
  });

  return {
    ...chat,
    messages: normalizedMessages,
    dynamicAgents
  };
}

// Export the service functions as a namespace object
export const ChatService = {
  createInitialChat: createInitialChatInternal,
  copyChat,
  copyMessagesToChat,
  getOrCreatePreviewChat,
  copyToPreview,
  getChatWithNormalizedMessages,
}; 