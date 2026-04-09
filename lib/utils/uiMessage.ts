import type { UIMessage } from 'ai'
import type { Message as PrismaMessage } from '@prisma/client'

// Extract plain text from a UIMessage parts array
export function uiMessageToPlainText(msg: UIMessage): string {
	try {
		const parts: any[] = (msg as any).parts
		if (Array.isArray(parts)) {
			const pieces = parts
				.map((part: any) => {
					if (part && typeof part === 'object') {
						if (part.type === 'text' && typeof part.text === 'string') return part.text
						// fallbacks for other content types when rendering as text
						if (typeof part.data === 'string') return part.data
						if (typeof part.value === 'string') return part.value
					}
					return ''
				})
				.filter(Boolean)
				.join('')
			return pieces
		}
		return ''
	} catch {
		return ''
	}
}

// Convert a Prisma message row to a full UIMessage (supports legacy string content)
export function dbMessageToUIMessage(db: PrismaMessage): UIMessage {

	// content either stores the UI interface or legacy string content
  const raw = db.content as any
  
  const uiMessage = {
    id: db.id,
    role: (db.role as any) || 'assistant',
    parts: (raw.parts || []),
    metadata: (db.metadata as any) || (raw.metadata as any) || {},
  } as any;

  // Content parts
  if (typeof raw === 'string') {
    uiMessage.parts.push({ type: 'text', text: raw });
  }

  // Progress parts
  if (!uiMessage.parts.find((part: any) => part.type === 'data-progress') && (db.metadata as any)?.progress) {
    uiMessage.parts.push({ type: 'data-progress', data: (db.metadata as any)?.progress });
  }

  // delete progress from metadata
  delete (uiMessage.metadata as any)?.progress;

  // Dialogue parts
  if (!uiMessage.parts.find((part: any) => part.type === 'data-dialogue') && (db.metadata as any)?.dialogue) {
    uiMessage.parts.push({ type: 'data-dialogue', data: (db.metadata as any)?.dialogue });
  }
  // delete dialogue from metadata
  delete (uiMessage.metadata as any)?.dialogue; 

  // Annotations
  if (db.annotations) {
    for (const annotation of db.annotations) {

      // transition annotation
      if (annotation && typeof annotation === 'object' && (annotation as any).type === 'transition') {
        uiMessage.parts.push({ type: 'data-transition', data: (annotation as any).content });
      }

      // dialogue annotation - convert old format to new structure
      if (annotation && typeof annotation === 'object' && (annotation as any).type === 'dialogue') {
        const content = (annotation as any).content;
        if (typeof content === 'string' && content.includes('||')) {
          const [senderId, receiverId] = content.split('||');
          uiMessage.parts.push({ 
            type: 'data-dialogue', 
            data: { senderId, receiverId }
          });
        }
      }

      // agent annotation
      
    }
  }

  // Metadata
  if (!uiMessage.metadata.sessionId && db.chatRoundSessionId) {
    uiMessage.metadata.sessionId = db.chatRoundSessionId;
  }

  // Add token usage to metadata if present in database
  if (db.promptTokens || db.completionTokens || db.totalTokens) {
    uiMessage.metadata.usage = {
      promptTokens: db.promptTokens,
      completionTokens: db.completionTokens,
      totalTokens: db.totalTokens
    };
    // Also keep totalTokens at root level for backward compatibility
    if (db.totalTokens) {
      uiMessage.metadata.totalTokens = db.totalTokens;
    }
  }

  return uiMessage;
}

// Wrap a UIMessage for storing inside Prisma Message.content (json)
export function uiMessageToDbContent(msg: UIMessage): any {
	return msg
}

// For legacy callers expecting Message with string content
export function dbMessageToLegacyAppMessage(db: PrismaMessage): { id: string; role: string; content: string; createdAt: Date; annotations?: any[]; metadata?: any } {
	const ui = dbMessageToUIMessage(db)
	return {
		id: db.id,
		role: db.role,
		content: uiMessageToPlainText(ui),
		createdAt: db.createdAt,
		annotations: (db.annotations as any) ?? [],
		metadata: (db.metadata as any) ?? {},
	}
}
 