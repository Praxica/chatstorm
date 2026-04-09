interface Memory {
  id: string;
  name: string;
  memorizeRound: string;
  memorizeInstructions: string;
  rememberWhen: 'every_round' | 'specific_rounds';
  rememberRounds?: Array<{ roundId: string; instructions: string }>;
  rememberInstructions?: string;
  rememberWho: 'every_agent' | 'original_agent';
  updateEnabled: boolean;
  updateWhen: 'every_round' | 'specific_rounds';
  updateRounds?: Array<{ roundId: string; instructions: string }>;
  updateInstructions?: string;
  updateWho: 'every_agent' | 'original_agent';
}

interface MemorySettings {
  memories?: Memory[];
}

interface MemoryImpact {
  memoriesToDelete: number;
  memoriesWithReferences: number;
  totalMemoryImpact: number;
}

/**
 * Analyzes the impact of deleting a round on memory settings
 * @param memorySettings - The config's memory settings
 * @param roundIdToDelete - The ID of the round being deleted
 * @returns Analysis of how many memories will be affected
 */
export function analyzeRoundDeletionImpact(
  memorySettings: MemorySettings | null | undefined,
  roundIdToDelete: string
): MemoryImpact {
  let memoriesToDelete = 0;
  let memoriesWithReferences = 0;

  if (!memorySettings?.memories) {
    return {
      memoriesToDelete: 0,
      memoriesWithReferences: 0,
      totalMemoryImpact: 0,
    };
  }

  memorySettings.memories.forEach((memory) => {
    // Check if this memory will be completely deleted
    if (memory.memorizeRound === roundIdToDelete) {
      memoriesToDelete++;
    } else {
      // Check if this memory has references that will be cleaned up
      const hasUpdateRefs = memory.updateRounds?.some((r) => r.roundId === roundIdToDelete);
      const hasRememberRefs = memory.rememberRounds?.some((r) => r.roundId === roundIdToDelete);
      
      if (hasUpdateRefs || hasRememberRefs) {
        memoriesWithReferences++;
      }
    }
  });

  return {
    memoriesToDelete,
    memoriesWithReferences,
    totalMemoryImpact: memoriesToDelete + memoriesWithReferences,
  };
}

/**
 * Cleans up memory settings after a round is deleted
 * @param memorySettings - The config's memory settings
 * @param roundIdToDelete - The ID of the round that was deleted
 * @returns Cleaned memory settings
 */
export function cleanupMemorySettingsAfterRoundDeletion(
  memorySettings: MemorySettings | null | undefined,
  roundIdToDelete: string
): MemorySettings | null {
  if (!memorySettings?.memories) {
    return memorySettings || null;
  }

  const cleanedMemories = memorySettings.memories.filter((memory) => {
    // Delete entire memory if it was memorized in the deleted round
    if (memory.memorizeRound === roundIdToDelete) {
      return false; // Remove this memory entirely
    }

    // Clean up round-specific references
    if (memory.updateRounds) {
      memory.updateRounds = memory.updateRounds.filter((r) => r.roundId !== roundIdToDelete);
    }
    if (memory.rememberRounds) {
      memory.rememberRounds = memory.rememberRounds.filter((r) => r.roundId !== roundIdToDelete);
    }

    return true; // Keep the memory
  });

  return { memories: cleanedMemories };
}