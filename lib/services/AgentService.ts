import { prisma } from "@/lib/prisma";
import { type ChatAgent } from '@/lib/stores/chatAgentStore';
import { type ChatAgent as PrismaChatAgent } from "@prisma/client";

interface AgentQueryOptions {
  includeDynamic?: boolean;
}

const toViewModel = (agent: PrismaChatAgent & { projects: { id: string }[] }): ChatAgent => {
  return {
    ...agent,
    avatar: agent.avatar || undefined,
    model: agent.model || undefined,
    temperature: agent.temperature || undefined,
    modelSelectionMode: (agent.modelSelectionMode as any) || 'default',
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    projectIds: agent.projects.map(p => p.id),
  };
};

export const AgentService = {
  getAgentsViaApi: async (options: AgentQueryOptions = {}): Promise<ChatAgent[]> => {
    const { includeDynamic = false } = options;
    let url = '/api/agents';
  
    if (includeDynamic) {
      url += '?includeDynamic=true';
    }
  
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    return response.json();
  },

  getChatAgentsViaApi: async (chatId: string): Promise<ChatAgent[]> => {
    const response = await fetch(`/api/chats/${chatId}/agents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chat agents: ${response.statusText}`);
    }
    return response.json();
  },

  getTemplateAgentsViaApi: async (templateId: string): Promise<ChatAgent[]> => {
    const response = await fetch(`/api/preview/${templateId}/agents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch template agents: ${response.statusText}`);
    }
    return response.json();
  },

  getShareAgentsViaApi: async (shareId: string): Promise<ChatAgent[]> => {
    const response = await fetch(`/api/shares/${shareId}/agents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch share agents: ${response.statusText}`);
    }
    return response.json();
  },

  getAgentsFromConfig: async (configId: string): Promise<ChatAgent[]> => {
    // Get all rounds for this config
    const rounds = await prisma.chatRound.findMany({
      where: { configId },
      include: {
        participants: true
      }
    });

    if (!rounds?.length) return [];

    // Extract all unique agent IDs from the rounds (both participants and moderators)
    const agentIds = new Set<string>();
    
    rounds.forEach(round => {
      // Add participants
      round.participants.forEach((agent: any) => {
        agentIds.add(agent.id);
      });
      
      // Add moderator if present
      if (round.moderatorAgentId) {
        agentIds.add(round.moderatorAgentId);
      }
    });

    // Fetch the full agent data for all participants and moderators
    const agents = await prisma.chatAgent.findMany({
      where: {
        id: {
          in: Array.from(agentIds)
        }
      },
      include: {
        projects: {
          select: {
            id: true
          }
        }
      }
    });

    // Transform the response to match the expected format
    return agents.map(agent => toViewModel(agent));
  },

  getAgents: async (userId: string, options: AgentQueryOptions = {}): Promise<ChatAgent[]> => {
    const { includeDynamic = false } = options;

    const where: any = {
      userId: userId,
    };

    if (!includeDynamic) {
      where.isDynamic = false;
    }

    const agents = await prisma.chatAgent.findMany({
      where,
      orderBy: {
        createdAt: 'asc' 
      },
      include: {
        projects: {
          select: {
            id: true
          }
        }
      }
    });
    return agents.map(agent => toViewModel(agent));
  },

  getAllAgentsInRounds: async (rounds: any[]): Promise<ChatAgent[]> => {
    const agentIds = new Set<string>();
    rounds.forEach(round => {
      // Add participants
      round.participants.forEach((agent: any) => {
        agentIds.add(agent.id);
      });
      
      // Add moderator if present
      if (round.moderatorAgentId) {
        agentIds.add(round.moderatorAgentId);
      }
    });

    // Fetch the full agent data for all participants and moderators
    const agents = await prisma.chatAgent.findMany({
      where: {
        id: {
          in: Array.from(agentIds)
        }
      },
      include: {
        projects: {
          select: {
            id: true
          }
        }
      }
    });
    return agents.map(agent => toViewModel(agent));
  },

  getAllAgentsForUser: async function(userId: string): Promise<ChatAgent[]> {
    return this.getAgents(userId, { includeDynamic: true });
  }
}; 