import type { ChatAgent } from '@/lib/stores/chatAgentStore'

export interface AgentProjectUpdates {
  projectIdsToAdd?: string[]
  projectIdsToRemove?: string[]
}

export async function updateAgentProjects(id: string, updates: AgentProjectUpdates) {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  return response.json()
}

export async function updateAgent(id: string, updates: Partial<ChatAgent>) {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  return response.json()
}

export async function createAgent(agent: ChatAgent) {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent)
  })
  return response.json()
}

export async function deleteAgent(id: string) {
  await fetch(`/api/agents/${id}`, {
    method: 'DELETE'
  })
}