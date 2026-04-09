/**
 * Utility functions for working with chat rounds
 */

/** Minimal round shape required by getRoundName */
interface RoundLike {
  id: string;
  name?: string | null;
  type: string;
  sequence?: number;
}

/**
 * Get the display name for a round
 * @param roundId - The round ID to look up
 * @param rounds - Array of available rounds (only id, name, type, sequence are used)
 * @param options - Configuration options for display
 * @returns The round name, type, or roundId as fallback
 */
export const getRoundName = (
  roundId: string,
  rounds: RoundLike[],
  options: {
    useShortFallback?: boolean;
    includeSequence?: boolean;
  } = {}
): string => {
  const { useShortFallback = false, includeSequence = false } = options;
  const round = rounds.find(r => r.id === roundId);
  
  if (!round) {
    return useShortFallback ? `Round ${roundId.substring(0, 5)}...` : roundId;
  }
  
  // If round has a custom name, use it
  if (round.name) {
    return round.name;
  }
  
  // If includeSequence is true, add sequence info to type
  if (includeSequence && round.sequence !== undefined) {
    return `${round.type.charAt(0).toUpperCase() + round.type.slice(1)} (${round.sequence})`;
  }
  
  return round.type || roundId;
};