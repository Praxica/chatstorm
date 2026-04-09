import { Config, ChatRound } from '@prisma/client';

// Define a type for the Config data including rounds
export type ConfigWithRounds = Config & {
  rounds: ChatRound[];
  projects: { id: string }[];
};

// Helper for development-only logging
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG][shareService] ${message}`, ...args);
  }
};

export async function loadShareConfig(shareId: string): Promise<ConfigWithRounds> {
  logDebug('Loading detailed share data for share:', shareId);
  
  const configResponse = await fetch(`/api/shares/${shareId}/config`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!configResponse.ok) {
    const errorText = await configResponse.text();
    throw new Error(`Failed to load shared config details: ${configResponse.status} - ${errorText}`);
  }

  const configData: ConfigWithRounds = await configResponse.json();
  logDebug('Detailed shared config data loaded:', configData);
  
  return configData;
} 