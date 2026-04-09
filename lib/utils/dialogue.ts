import { getData } from '@/lib/chat/services/ui-message';

interface DialogueData {
  senderId?: string;
  receiverId?: string;
}

/**
 * Get dialogue data from a message, checking both data parts and metadata
 */
export function getDialogueData(message: any): DialogueData | undefined {
  return getData<DialogueData>(message, 'dialogue') 
    || (message?.metadata?.dialogue as DialogueData | undefined);
}

/**
 * Create a unique key for a dialogue session
 */
export function getDialogueKey(dialogue: DialogueData | undefined): string | undefined {
  if (!dialogue) return undefined;
  const { senderId, receiverId } = dialogue;
  if (!senderId && !receiverId) return undefined;
  return `${senderId || ''}||${receiverId || ''}`;
}

/**
 * Check if this is the first message in a dialogue sequence
 */
export function isFirstDialogueMessage(
  currentMessage: any, 
  previousMessage: any
): boolean {
  const currentDialogue = getDialogueData(currentMessage);
  if (!currentDialogue) return false; // Not a dialogue message
  
  const previousDialogue = getDialogueData(previousMessage);
  const currentKey = getDialogueKey(currentDialogue);
  const previousKey = getDialogueKey(previousDialogue);
  
  return !previousKey || previousKey !== currentKey;
}

/**
 * Get dialogue info for a message (used by ChatMessage component)
 */
export function getDialogueInfo(currentMessage: any, previousMessage: any) {
  const currentDialogue = getDialogueData(currentMessage);
  
  if (!currentDialogue) {
    return { isDialogue: false, isFirstMessage: false };
  }
  
  return {
    isDialogue: true,
    isFirstMessage: isFirstDialogueMessage(currentMessage, previousMessage),
    senderId: currentDialogue.senderId,
    receiverId: currentDialogue.receiverId,
    dialogueKey: getDialogueKey(currentDialogue)
  };
}