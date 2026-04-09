import type { UIMessage } from 'ai';

interface BuildParams {
  role: 'assistant' | 'user';
  text?: string;
  parts?: Array<any>;
  metadata?: Record<string, any>;
  dataParts?: Array<{ type: string; data: any }>;
}

export function createUiMessage(params: BuildParams): UIMessage {
  const baseParts: any[] = [];
  if (params.parts && Array.isArray(params.parts)) {
    baseParts.push(...params.parts);
  } else if (typeof params.text === 'string') {
    baseParts.push({ type: 'text', text: params.text });
  }

  if (Array.isArray(params.dataParts)) {
    // Filter out data types that should not be persisted to avoid issues on reload
    const excludedTypes = ['data-agents']; // data-agents would cause duplicate agents on reload
    
    for (const p of params.dataParts) {
      if (p && typeof p.type === 'string' && !excludedTypes.includes(p.type)) {
        baseParts.push({ type: p.type, data: p.data });
      }
    }
  }

  const message: any = {
    role: params.role,
    parts: baseParts,
  };

  if (params.metadata && typeof params.metadata === 'object') {
    message.metadata = { ...params.metadata };
  }

  return message as UIMessage;
}

export function getData<T = unknown>(message: UIMessage | any, key: string): T | undefined {
  try {
    const parts: any[] = (message as any)?.parts;
    if (Array.isArray(parts)) {
      const part = parts.find(p => p && typeof p.type === 'string' && p.type === `data-${key}`);
      return part?.data as T | undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Strip metadata from a UIMessage for DB content storage to avoid duplication
export function stripMetadata(msg: UIMessage | any): any {
  try {
    const { metadata: _omit, ...rest } = (msg || {}) as any;
    return rest;
  } catch {
    return msg;
  }
}

/**
 * Convert UI messages to model messages format for AI SDK messages
 * @param uiMessages Array of UIMessage objects
 * @returns Array of simple messages with role and content
 */
export function convertUIMessagesToModelMessages(uiMessages: any[]): any[] {
  return uiMessages.map((msg: any) => ({
    role: msg.role,
    content: msg.parts?.find((p: any) => p.type === 'text')?.text || ''
  }));
}

