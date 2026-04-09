import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { updateAgent as updateAgentApi, createAgent, deleteAgent, updateAgentProjects, type AgentProjectUpdates } from '@/lib/utils/agents'
import { AgentService } from '@/lib/services/AgentService'
import type { ChatAgent } from '@/lib/schemas/agent'

// Re-export so existing consumers of `ChatAgent` from this file continue working
export type { ChatAgent } from '@/lib/schemas/agent'

export type AgentSortField = 'name' | 'createdAt'
export type SortDirection = 'asc' | 'desc'

interface ChatAgentStore {
  agents: ChatAgent[]
  isLoading: boolean
  sortBy: AgentSortField
  sortDirection: SortDirection
  projectFilter: string[]
  addAgent: (agent: ChatAgent) => Promise<void>
  updateAgent: (id: string, updates: Partial<ChatAgent>) => Promise<void>
  updateAgentProjects: (id: string, updates: AgentProjectUpdates) => Promise<void>
  removeAgent: (id: string) => Promise<void>
  removeAgentsFromStore: (ids: string[]) => void
  toggleAgentActive: (id: string) => Promise<void>
  getActiveAgents: () => ChatAgent[]
  getSortedAgents: () => ChatAgent[]
  setSorting: (sortBy: AgentSortField, sortDirection: SortDirection) => void
  setProjectFilter: (projectIds: string[]) => void
  loadAgents: () => Promise<void>
  setAgents: (agents: ChatAgent[]) => void
  getAgent: (key: string) => ChatAgent | undefined
}

const sortAgents = (agents: ChatAgent[], sortBy: AgentSortField, direction: SortDirection): ChatAgent[] => {
  return [...agents].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortBy) {
      case 'name':
        aValue = a.name?.toLowerCase() || ''
        bValue = b.name?.toLowerCase() || ''
        break
      case 'createdAt':
        aValue = new Date(a.createdAt || 0).getTime()
        bValue = new Date(b.createdAt || 0).getTime()
        break
      default:
        return 0
    }

    if (aValue < bValue) {
      return direction === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return direction === 'asc' ? 1 : -1
    }
    return 0
  })
}

type ChatAgentPersist = (
  config: StateCreator<ChatAgentStore>,
  options: unknown
) => StateCreator<ChatAgentStore>

export const useChatAgentStore = create<ChatAgentStore>()(
  (persist as ChatAgentPersist)(
    (set, get) => ({
      agents: [],
      isLoading: true,
      sortBy: 'name',
      sortDirection: 'asc',
      projectFilter: [],

      loadAgents: async () => {
        try {
          const agents = await AgentService.getAgentsViaApi()
          set({ agents, isLoading: false })
        } catch (error) {
          console.error('Failed to load agents:', error)
          set({ agents: [], isLoading: false })
        }
      },
      
      getSortedAgents: () => {
        const state = get()
        return sortAgents(state.agents, state.sortBy, state.sortDirection)
      },

      setSorting: (sortBy: AgentSortField, sortDirection: SortDirection) => {
        set({ sortBy, sortDirection })
      },

      setProjectFilter: (projectIds: string[]) => {
        set({ projectFilter: projectIds })
      },

      addAgent: async (agent: ChatAgent) => {
        try {
          const savedAgent = await createAgent(agent)
          set((state) => ({ 
            agents: [...state.agents, savedAgent] 
          }))
        } catch (error) {
          console.error('Error adding agent:', error)
          throw error
        }
      },

      updateAgent: async (id: string, updates: Partial<ChatAgent>) => {
        try {
          const updatedAgent = await updateAgentApi(id, updates)
          set((state) => ({
            agents: state.agents.map(agent =>
              agent.id === id ? updatedAgent : agent
            )
          }))
        } catch (error) {
          console.error('Error updating agent:', error)
          throw error
        }
      },

      updateAgentProjects: async (id: string, updates: AgentProjectUpdates) => {
        try {
          const updatedAgent = await updateAgentProjects(id, updates)
          set((state) => ({
            agents: state.agents.map(agent =>
              agent.id === id ? updatedAgent : agent
            )
          }))
        } catch (error) {
          console.error('Error updating agent projects:', error)
          throw error
        }
      },

      removeAgent: async (id: string) => {
        try {
          await deleteAgent(id)
          set((state) => ({
            agents: state.agents.filter(agent => agent.id !== id)
          }))
        } catch (error) {
          console.error('Error removing agent:', error)
          throw error
        }
      },

      toggleAgentActive: async (id: string) => {
        const agent = get().agents.find(a => a.id === id)
        if (!agent) throw new Error('Agent not found')
        
        try {
          const updatedAgent = await updateAgentApi(id, { 
            isActive: !agent.isActive 
          })
          set((state) => ({
            agents: state.agents.map(a =>
              a.id === id ? updatedAgent : a
            )
          }))
        } catch (error) {
          console.error('Error toggling agent:', error)
          throw error
        }
      },

      getActiveAgents: () => {
        const state = get()
        const activeAgents = state.agents.filter((agent: ChatAgent) => agent.isActive)
        return sortAgents(activeAgents, state.sortBy, state.sortDirection)
      },

      setAgents: (agents) => set({ agents }),

      getAgent: (key: string) => get().agents.find(agent => agent.id === key),

      removeAgentsFromStore: (ids: string[]) => {
        set((state) => ({
          agents: state.agents.filter(agent => !ids.includes(agent.id))
        }))
      }
    }),
    {
      name: 'chat-agents-storage',
      version: 2,
      partialize: (state: ChatAgentStore) => ({
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        agents: []
      })
    }
  )
) 