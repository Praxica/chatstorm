import { useState, useEffect } from 'react'
import { CheckSquare, PenLine, UserPlus, Wand2 } from 'lucide-react'
import { AgentSelectionList } from '@/components/ui/agent-selection-list'
import { ConfigRoundGenerateAgents, type GenerationConfig } from '@/components/ConfigRoundGenerateAgents'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import ChatAgentEdit from '@/components/ChatAgentEdit'
import { useChatAgentStore, type ChatAgent } from '@/lib/stores/chatAgentStore'
import { createAvatar } from '@dicebear/core'
import * as miniavs from '@dicebear/miniavs'
import * as bottts from '@dicebear/bottts'
import * as funEmoji from '@dicebear/fun-emoji'
import * as pixelArt from '@dicebear/pixel-art'

export type AgentMenuOption = 'select' | 'prompt' | 'add' | 'generate'

interface AgentSelectionStepProps {
  selectedAgents: string[]
  onSelectAgents: (agentIds: string[]) => void
  encodeAvatarSvg: (svg: string | undefined) => string
  generationConfig?: Partial<GenerationConfig>
  onUpdateGenerationConfig?: (config: Partial<GenerationConfig>) => void
  onMenuOptionChange?: (option: AgentMenuOption) => void
  initialProjectFilter?: string[]
}

const AGENT_MENU_OPTIONS = {
  select: {
    icon: CheckSquare,
    title: 'Select Agents',
    description: 'to use in this round'
  },
  prompt: {
    icon: PenLine,
    title: 'Prompt Agents',
    description: 'for this round using AI'
  },
  add: {
    icon: UserPlus,
    title: 'Create an Agent',
    description: 'to add to your collection'
  },
  generate: {
    icon: Wand2,
    title: 'Create with AI',
    description: 'to generate multiple new agents'
  }
}

export function AgentSelectionStep({
  selectedAgents,
  onSelectAgents,
  encodeAvatarSvg,
  generationConfig = {},
  onUpdateGenerationConfig = () => {},
  onMenuOptionChange,
  initialProjectFilter
}: AgentSelectionStepProps) {
  const [selectedOption, setSelectedOption] = useState<AgentMenuOption>('select')

  const handleMenuOptionChange = (option: AgentMenuOption) => {
    setSelectedOption(option)
    onMenuOptionChange?.(option)
  }
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false)
  const [editingAgent, setEditingAgent] = useState<ChatAgent | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const addAgent = useChatAgentStore(state => state.addAgent)
  const updateAgent = useChatAgentStore(state => state.updateAgent)
  const allAgents = useChatAgentStore(state => state.agents)
  const hasExistingAgents = allAgents.length > 0

  const currentOption = AGENT_MENU_OPTIONS[selectedOption]
  const Icon = currentOption.icon

  // Listen for agent store changes to refresh the list
  useEffect(() => {
    const unsubscribe = useChatAgentStore.subscribe(() => {
      setRefreshKey(prev => prev + 1)
    })
    return unsubscribe
  }, [])

  // Listen for generated agents to auto-select them
  useEffect(() => {
    const handleAgentsGenerated = (event: CustomEvent) => {
      const generatedAgentIds = event.detail?.agentIds as string[]
      if (generatedAgentIds && generatedAgentIds.length > 0) {
        // Add the generated agents to the selection
        const newSelection = [...new Set([...selectedAgents, ...generatedAgentIds])]
        onSelectAgents(newSelection)
      }
    }

    window.addEventListener('agentsGenerated' as any, handleAgentsGenerated as any)
    return () => {
      window.removeEventListener('agentsGenerated' as any, handleAgentsGenerated as any)
    }
  }, [selectedAgents, onSelectAgents])

  const handleAddAgent = () => {
    // Create a new empty agent with random avatar
    const avatarStyles = [
      (seed: string) => createAvatar(miniavs, { seed }),
      (seed: string) => createAvatar(bottts, { seed, backgroundColor: ['b6e3f4'] }),
      (seed: string) => createAvatar(funEmoji, { seed }),
      (seed: string) => createAvatar(pixelArt, { seed, backgroundColor: ['d1d4f9'] })
    ]
    const randomStyle = avatarStyles[Math.floor(Math.random() * avatarStyles.length)]
    const avatar = randomStyle(Date.now().toString()).toString()

    const emptyAgent: ChatAgent = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      systemPrompt: '',
      priority: '',
      avatar,
      temperature: 0.7,
      isActive: true,
      projectIds: []
    }

    setEditingAgent(emptyAgent)
    setShowAddAgentDialog(true)
  }

  const handleSaveAgent = async (agent: ChatAgent) => {
    setIsSaving(true)
    try {
      // Check if this is a new agent (not in store yet)
      const isNew = !useChatAgentStore.getState().agents.find(a => a.id === agent.id)

      if (isNew) {
        await addAgent(agent)
        // Auto-select the newly created agent
        onSelectAgents([...selectedAgents, agent.id])
      } else {
        await updateAgent(agent.id, agent)
      }

      setShowAddAgentDialog(false)
      setEditingAgent(null)
    } catch (error) {
      console.error('Error saving agent:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateAgents = () => {
    // Dispatch event to open the generate agents modal
    window.dispatchEvent(new CustomEvent('agentsList:showGeneratePanel'))
  }

  return (
    <div className="flex gap-8">
      {/* Left column: Menu options */}
      <div className="w-44 flex-shrink-0">
        <div className="space-y-2">
          {/* Select Agents */}
          {(() => {
            const option = AGENT_MENU_OPTIONS.select
            const OptionIcon = option.icon
            const isSelected = selectedOption === 'select'
            return (
              <button
                onClick={() => handleMenuOptionChange('select')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                  isSelected
                    ? "bg-black text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                )}
              >
                <OptionIcon className="w-4 h-4" />
                {option.title}
              </button>
            )
          })()}

          {/* Prompt Agents */}
          {(() => {
            const option = AGENT_MENU_OPTIONS.prompt
            const OptionIcon = option.icon
            const isSelected = selectedOption === 'prompt'
            return (
              <button
                onClick={() => handleMenuOptionChange('prompt')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                  isSelected
                    ? "bg-black text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                )}
              >
                <OptionIcon className="w-4 h-4" />
                {option.title}
              </button>
            )
          })()}
        </div>
      </div>

      {/* Right column: Content */}
      <div className="flex-1 min-w-0">
        {/* Header with icon, title, and description - hide if no existing agents */}
        {hasExistingAgents && (
          <div className="mb-4 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 flex-shrink-0" />
                <div className="flex items-baseline gap-2" style={{ marginTop: '3px' }}>
                  <h3 className="text-lg font-semibold">{currentOption.title}</h3>
                  <p className="text-sm text-gray-500">{currentOption.description}</p>
                </div>
              </div>

              {/* Add agent buttons - only show when Select Agents is active */}
              {selectedOption === 'select' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleAddAgent}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors bg-gray-100 hover:bg-gray-200 text-gray-900"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add agent
                  </button>
                  <button
                    onClick={handleGenerateAgents}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors bg-gray-100 hover:bg-gray-200 text-gray-900"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Add w/ AI
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SELECT Option */}
        <div className={cn(selectedOption === 'select' ? 'block' : 'hidden')}>
          {hasExistingAgents ? (
            <AgentSelectionList
              key={refreshKey}
              selectedAgents={selectedAgents}
              onSelectionChange={onSelectAgents}
              encodeAvatarSvg={encodeAvatarSvg}
              allowMultiple={true}
              showSearch={true}
              showFilters={true}
              showSelectAllClear={true}
              initialProjectFilter={initialProjectFilter}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
                <p className="text-sm text-gray-600 max-w-sm">
                  Create your first agent to add to this round. You can create one manually or use AI to generate multiple agents at once.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddAgent}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors bg-black text-white hover:bg-gray-800"
                >
                  <UserPlus className="w-4 h-4" />
                  Add agent
                </button>
                <button
                  onClick={handleGenerateAgents}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-900"
                >
                  <Wand2 className="w-4 h-4" />
                  Add w/ AI
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PROMPT Option */}
        <div className={cn(selectedOption === 'prompt' ? 'block' : 'hidden')}>
          <ConfigRoundGenerateAgents
            config={generationConfig}
            onUpdate={onUpdateGenerationConfig}
          />
        </div>

        {/* ADD Option */}
        <div className={cn(selectedOption === 'add' ? 'block' : 'hidden')}>
          <div className="text-sm text-gray-500">Add an agent form placeholder</div>
        </div>

        {/* GENERATE Option */}
        <div className={cn(selectedOption === 'generate' ? 'block' : 'hidden')}>
          <div className="text-sm text-gray-500">Generate agents form placeholder</div>
        </div>
      </div>

      {/* Add Agent Dialog */}
      <Dialog open={showAddAgentDialog} onOpenChange={(open) => {
        if (!open && !isSaving) {
          setShowAddAgentDialog(false)
          setEditingAgent(null)
        }
      }}>
        <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] flex flex-col">
          {editingAgent && (
            <ChatAgentEdit
              agent={editingAgent}
              onClose={() => {
                if (!isSaving) {
                  setShowAddAgentDialog(false)
                  setEditingAgent(null)
                }
              }}
              onSave={handleSaveAgent}
              isCreating={true}
              isSaving={isSaving}
              asDialog={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
