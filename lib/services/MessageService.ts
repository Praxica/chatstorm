import { Message } from '@/types/message';
import { prisma } from '@/lib/prisma';
import type { UIMessage } from 'ai';
import { dbMessageToLegacyAppMessage, dbMessageToUIMessage } from '@/lib/utils/uiMessage';

export class MessageService {
  /**
   * Get messages for a chat via API (legacy Message shape for existing callers)
   */
  static async getChatMessagesViaApi(chatId: string): Promise<Message[]> {
    const response = await fetch(`/api/chats/${chatId}/messages`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chat messages: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get messages for a template preview via API (legacy Message shape)
   */
  static async getTemplateMessagesViaApi(templateId: string): Promise<Message[]> {
    const response = await fetch(`/api/preview/${templateId}/messages`);
    if (!response.ok) {
      throw new Error(`Failed to fetch template messages: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get messages for a share via API (legacy Message shape)
   */
  static async getShareMessagesViaApi(shareId: string): Promise<Message[]> {
    const response = await fetch(`/api/shares/${shareId}/messages`);
    if (!response.ok) {
      throw new Error(`Failed to fetch share messages: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get messages for a chat directly from the database as UIMessage[]
   */
  static async getUIMessagesByChat(chatId: string): Promise<UIMessage[]> {
    const rows = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' }
    });
    return rows.map(dbMessageToUIMessage);
  }


  /**
   * Normalize an array of database messages to UIMessage format
   */
  static normalizeMessages(messages: any[]) {
    // Transform messages to standardized UIMessage format with parts structure
    return messages.map(msg => {
      return dbMessageToUIMessage(msg);
    });
  }

  /**
   * Get messages for a chat directly from the database (legacy Message[])
   */
  static async getMessagesByChat(chatId: string): Promise<Message[]> {
    const rows = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' }
    });
    return rows.map(dbMessageToLegacyAppMessage);
  }
} 