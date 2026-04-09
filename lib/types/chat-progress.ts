/**
 * Shared ChatProgress type definition used by both frontend and backend
 */
export interface ChatProgress {
  messageCount: number;
  messageAuthors: string[];
  active: {
    step: 'user' | 'api';
    agent: {
      id: string;
      mode: 'moderator' | 'participant';
    },
    round: {
      id: string;
      isComplete: boolean;
      status?: 'active' | 'transition' | 'closed';
    },
    senders?: {
      allowed: string[];  // Agent IDs allowed to send messages
      determined: boolean;  // Whether determination has been made
    }
  },
  next: {
    agent?: {
      id: string;
      name?: string;
      mode: 'moderator' | 'participant';
    },
    step: 'user' | 'api',
    round: {
      id: string;
      status?: 'active' | 'transition' | 'closed';
    }
  },
  dialogue?: {
    senders: {
      [senderId: string]: {
        mode: 'skip' | 'dialogue' | 'complete' | 'pending';
        receivers: {
          [receiverId: string]: {
            mode: 'dialogue' | 'complete' | 'pending';
            messages: number;
          };
        };
      };
    };
    mode: 'pending' | 'dialogue' | 'complete';
    sender?: string;
    receiver?: string;
    systemPrompt?: string;
  }
}

/**
 * Creates a new initial progress object for a given round
 * @param roundId - The ID of the round to create progress for
 * @param initialStep - The initial step ('user' for frontend, 'api' for backend typically)
 * @returns A new ChatProgress object
 */
export function createInitialProgress(
  roundId: string, 
  initialStep: 'user' | 'api' = 'user'
): ChatProgress {
  return {
    messageCount: 0,
    messageAuthors: [],
    active: {
      step: initialStep,
      agent: {
        id: '', // Will be filled by the backend
        mode: 'participant'
      },
      round: {
        id: roundId,
        isComplete: false
      }
    },
    next: {
      step: initialStep === 'user' ? 'api' : 'user',
      round: {
        id: roundId
      }
    }
  };
}

/**
 * Normalizes a progress object to ensure all required fields exist
 * @param progress - The progress object to normalize
 * @returns A normalized ChatProgress object
 */
export function normalizeProgress(progress: Partial<ChatProgress>): ChatProgress {
  // Create a valid progress object with defaults
  const defaultProgress = createInitialProgress(
    progress.active?.round?.id || '',
    progress.active?.step || 'user'
  );

  // Merge the provided progress with defaults
  const normalized = {
    messageCount: progress.messageCount ?? defaultProgress.messageCount,
    messageAuthors: progress.messageAuthors ?? defaultProgress.messageAuthors,
    active: {
      step: progress.active?.step ?? defaultProgress.active.step,
      agent: {
        id: progress.active?.agent?.id ?? defaultProgress.active.agent.id,
        mode: progress.active?.agent?.mode ?? defaultProgress.active.agent.mode
      },
      round: {
        id: progress.active?.round?.id ?? defaultProgress.active.round.id,
        isComplete: progress.active?.round?.isComplete ?? defaultProgress.active.round.isComplete,
        status: progress.active?.round?.status ?? 'active'
      },
      senders: (progress.active as any)?.senders ?? undefined
    },
    next: {
      step: progress.next?.step ?? defaultProgress.next.step,
      round: {
        id: progress.next?.round?.id ?? defaultProgress.next.round.id,
        status: progress.next?.round?.status ?? 'active'
      },
      agent: {
        id: progress.next?.agent?.id ?? defaultProgress.next.agent?.id ?? '',
        mode: progress.next?.agent?.mode ?? defaultProgress.next.agent?.mode ?? 'participant'
      }
    }
  };

  // Ensure agent mode is set if not present
  if (!normalized.active.agent.mode) {
    normalized.active.agent.mode = 'participant';
  }

  // Preserve dialogue state if it exists
  if (progress.dialogue) {
    (normalized as any).dialogue = progress.dialogue;
  }

  return normalized;
} 