import { type Round, type DepthLevel, DEPTH_DESCRIPTIONS, type LengthType, shouldShowInput, type RoundActionType, type StanceType, type ParticipantOrder } from '../types/config-round'
import { analyzeRoundDeletionImpact } from '@/lib/utils/memory'
import { X, CheckIcon, MoreHorizontal, Pencil, AlertTriangle, Database, SlidersHorizontal, FileText } from 'lucide-react'
import { Button } from "./ui/button"
import { Slider } from "./ui/slider"
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { CREATIVITY_LABELS } from "./ui/creativity-slider"
import { useState, useCallback } from "react"
import { Input } from "./ui/input"
import { cn } from "@/lib/utils"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { AgentAvatarList } from "./ui/agent-avatar-list"
import { useChatAgentStore } from "@/lib/stores/chatAgentStore"
import IconPicker from "@/components/IconPicker"
import { RoundIcon } from "@/components/rounds/RoundIcon"
import { RoundDataModal } from "./rounds/RoundDataModal"
import { useConfigsStore } from "@/lib/stores/configsStore"
import { type ChatAgent } from '@/lib/stores/chatAgentStore'
import { RoundRetentionSettingsModal } from './retention/RoundRetentionSettingsModal'
import { RoundRetentionSettings } from '@/lib/chat/services/retention-types'
import { useToast } from './hooks/use-toast'
import { useModelsStore } from '@/lib/stores/modelsStore'
import { PromptsViewModal } from './PromptsViewModal'
import { MemoryModal } from './memory/MemoryModal'

interface ChatRoundItemProps {
  round: Round
  isActive: boolean
  onRemove: (id: string) => void
  onUpdate: (id: string, config: Partial<Round>) => void
  onEditParticipants: (id: string) => void
  onEditLimit: (id: string) => void
  onEditAction: (id: string) => void
  onEditStance: (id: string) => void
  onEditStyle: (id: string) => void
  onEditOptions: (id: string) => void
  onEditDataTool: (id: string) => void
  onEditDialogueSenders: (id: string) => void
  onEditDialogueReceivers: (id: string) => void
  onEditDialogue: (id: string) => void
  encodeAvatarSvg: (svg: string | undefined) => string
  configId: string
}

const getLimitSummary = (
  lengthType: LengthType | undefined, 
  lengthNumber?: number, 
  lengthRounds?: number,
  round?: Round,
  resolvedParticipants?: any[],
  onAgentClick?: (agent: ChatAgent) => void
) => {
  switch (lengthType || 'rounds') {
    case 'total':
      const num = lengthNumber || 1
      return (
        <>
          <span className="text-black">End</span>—after {num} {num === 1 ? 'message' : 'messages'}
        </>
      )
    case 'moderator':
      // If lengthModerator exists, try to find the agent
      let lengthModerator: ChatAgent | null = null
      if (round?.lengthModerator) {
        // First check if we can find the agent in the resolved participants list
        const moderatorAgent = resolvedParticipants?.find(agent => agent.id === round.lengthModerator);
        if (moderatorAgent) {
          lengthModerator = moderatorAgent;
        } else {
          // Try to find the agent in any available agents
          const allAgents = useChatAgentStore.getState().agents;
          const agentFromStore = allAgents.find(agent => agent.id === round.lengthModerator);
          if (agentFromStore) {
            lengthModerator = agentFromStore;
          }
        }
      }
      
      const maxMessages = lengthNumber || 10
      return (
        <>
          <span className="text-black">End</span>—when{' '}
          {lengthModerator ? (
            <button
              className="text-black underline hover:text-blue-600"
              onClick={() => onAgentClick?.(lengthModerator!)}
            >
              {lengthModerator.name}
            </button>
          ) : (
            <span className="text-yellow-600">
              {round?.lengthModerator ? `moderator (ID: ${round.lengthModerator.substring(0, 8)}...)` : "(select moderator)"}
            </span>
          )}
          {' '}decides (max {maxMessages} {maxMessages === 1 ? 'message' : 'messages'})
        </>
      )
    case 'rounds':
    default:
      const rounds = lengthRounds || 1
      return (
        <>
          <span className="text-black">End</span>—after {rounds} {rounds === 1 ? 'message' : 'messages'} per participant
        </>
      )
  }
}

const getParticipantOrderSummary = (
  order: ParticipantOrder | undefined, 
  round: Round, 
  resolvedParticipants: any[],
  onAgentClick: (agent: ChatAgent) => void
) => {
  switch (order) {
    case 'random':
      return (
        <>
          <span className="text-black">Order</span>—is random
        </>
      )
    case 'handoff':
      return (
        <>
          <span className="text-black">Order</span>—the active agent decides
        </>
      )
    case 'moderator':
      // If moderatorAgentId exists, try to find the agent in resolved participants first
      let moderator: ChatAgent | null = null
      if (round.moderatorAgentId) {
        // First check if we can find the agent in the resolved participants list
        const moderatorAgent = resolvedParticipants?.find(agent => agent.id === round.moderatorAgentId);
        if (moderatorAgent) {
          moderator = moderatorAgent;
        } else {
          // Try to find the agent in any available agents (might be added later)
          const allAgents = useChatAgentStore.getState().agents;
          const agentFromStore = allAgents.find(agent => agent.id === round.moderatorAgentId);
          if (agentFromStore) {
            moderator = agentFromStore;
          }
        }
      }
      
      return (
        <>
          <span className="text-black">Order</span>—moderated by{' '}
          {moderator ? (
            <button
              className="text-black underline hover:text-blue-600"
              onClick={() => onAgentClick(moderator!)}
            >
              {moderator.name}
            </button>
          ) : (
            <span className="text-yellow-600">
              {round.moderatorAgentId ? `moderator (ID: ${round.moderatorAgentId.substring(0, 8)}...)` : "(select moderator)"}
            </span>
          )}
        </>
      )
    case 'default':
    default:
      return (
        <>
          <span className="text-black">Order</span>—by default
        </>
      )
  }
}

const getActionSummary = (action?: RoundActionType) => {
  switch (action) {
    case 'winner':
      return 'Declare a winner'
    case 'rank':
      return 'Rank the best responses'
    case 'summarize':
    default:
      return 'Summarize the discussion'
  }
}

const getStanceSummary = (stanceType?: StanceType) => {
  switch (stanceType) {
    case 'ai':
      return 'AI decides'
    case 'custom':
      return 'Custom'
    default:
      return 'AI decides'
  }
}

const getDepthSummary = (depth?: DepthLevel, label: string = "Depth") => {
  const depthValue = depth || 'medium' as DepthLevel
  const description = DEPTH_DESCRIPTIONS[depthValue]
  const depthLabel = depthValue.charAt(0).toUpperCase() + depthValue.slice(1)
  return (
    <>
      {label && (
        <>
          <span className="text-black">{label}:</span>
          {" "}
        </>
      )}
      <span className="text-black">{depthLabel}</span>
      <span>—{description}</span>
    </>
  )
}

// This function will be moved inside the component

// Add a new function to get the data tool summary
const getDataToolSummary = (round: Round) => {
  if (!round.dataTool || !round.dataTool.parameters.length) {
    return (
      <div className="text-sm text-muted-foreground">
        none
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">
        {round.dataTool.parameters.length} parameter{round.dataTool.parameters.length !== 1 ? 's' : ''} defined
      </div>
    </div>
  )
}

const getDialogueSendersSummary = (round: Round, agents: any[] = [], encodeAvatarSvg?: (svg: string | undefined) => string) => {
  if (!round.dialogueSenderMode) return { text: 'All participants can send messages' }
  
  switch (round.dialogueSenderMode) {
    case 'select':
      const senderCount = round.dialogueSelectedSenders?.length || 0
      if (senderCount === 0) return { text: 'No senders selected' }
      
      // Get selected agents with their details
      const selectedAgents = round.dialogueSelectedSenders
        ?.map(id => agents.find(a => a.id === id))
        .filter(Boolean)
        .slice(0, 3) // Show max 3 agents
        
      if (selectedAgents && selectedAgents.length > 0) {
        return {
          jsx: (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedAgents.map((agent, index) => (
                <div key={agent.id} className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={encodeAvatarSvg?.(agent.avatar)} />
                    <AvatarFallback className="text-xs">{agent.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>{agent.name}</span>
                  {index < selectedAgents.length - 1 && <span>,</span>}
                </div>
              ))}
              {senderCount > 3 && <span>and {senderCount - 3} more</span>}
            </div>
          )
        }
      }
      
      return { text: `${senderCount} selected senders` }
    case 'agent_decides':
      return { text: 'Each agent decides when to send' }
    case 'moderator_decides':
      return { text: 'Moderator controls who sends messages' }
    case 'all_participants':
    default:
      return { text: 'All participants can send messages' }
  }
}

const getDialogueReceiversSummary = (round: Round, agents: any[] = [], encodeAvatarSvg?: (svg: string | undefined) => string) => {
  if (!round.dialogueReceiverMode) return { text: 'All participants receive messages' }
  
  switch (round.dialogueReceiverMode) {
    case 'select':
      const receiverCount = round.dialogueSelectedReceivers?.length || 0
      if (receiverCount === 0) return { text: 'No receivers selected' }
      
      // Get selected agents with their details
      const selectedAgents = round.dialogueSelectedReceivers
        ?.map(id => agents.find(a => a.id === id))
        .filter(Boolean)
        .slice(0, 3) // Show max 3 agents
        
      if (selectedAgents && selectedAgents.length > 0) {
        return {
          jsx: (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedAgents.map((agent, index) => (
                <div key={agent.id} className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={encodeAvatarSvg?.(agent.avatar)} />
                    <AvatarFallback className="text-xs">{agent.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>{agent.name}</span>
                  {index < selectedAgents.length - 1 && <span>,</span>}
                </div>
              ))}
              {receiverCount > 3 && <span>and {receiverCount - 3} more</span>}
            </div>
          )
        }
      }
      
      return { text: `${receiverCount} selected receivers` }
    case 'agent_decides':
      return { text: 'Senders choose their recipients' }
    case 'moderator_decides':
      return { text: 'Moderator determines recipients' }
    case 'all_participants':
    default:
      return { text: 'All participants receive messages' }
  }
}

const getDialogueSummary = (round: Round) => {
  const parts = []
  
  // Initial message
  if (round.dialogueInitialMessageMode === 'manual') {
    parts.push('Manual initial message')
  } else if (round.dialogueInitialMessageMode === 'generate') {
    parts.push('AI generates prompt for initial message')
  } else {
    parts.push('Default initial message')
  }
  
  // Length
  if (round.dialogueLengthMode === 'fixed') {
    parts.push(`${round.dialogueLength || 10} messages`)
  } else if (round.dialogueLengthMode === 'agent_decides') {
    parts.push('Agents decide length')
  } else if (round.dialogueLengthMode === 'moderator_decides') {
    parts.push('Moderator decides length')
  } else {
    parts.push('10 messages')
  }
  
  return parts.join(', ')
}

const getTransitionSummary = (
  round: Round,
  resolvedParticipants: any[],
  onAgentClick: (agent: ChatAgent) => void
) => {
  switch (round.transition) {
    case 'auto':
      return (
        <>
          <span className="text-black">Next</span>—automatically
        </>
      )
    case 'conditional':
      // Find the transition moderator agent
      let transitionModerator: ChatAgent | null = null
      if (round.transitionModerator) {
        const moderatorAgent = resolvedParticipants?.find(agent => agent.id === round.transitionModerator)
        if (moderatorAgent) {
          transitionModerator = moderatorAgent
        } else {
          // Try to find the agent in any available agents
          const allAgents = useChatAgentStore.getState().agents
          const agentFromStore = allAgents.find(agent => agent.id === round.transitionModerator)
          if (agentFromStore) {
            transitionModerator = agentFromStore
          }
        }
      }

      const conditionsCount = round.transitionConditions?.length || 0
      return (
        <>
          <span className="text-black">Next</span>—{' '}
          {transitionModerator ? (
            <button
              className="text-black underline hover:text-blue-600"
              onClick={() => onAgentClick(transitionModerator!)}
            >
              {transitionModerator.name}
            </button>
          ) : (
            <span className="text-yellow-600">
              {round.transitionModerator ? `moderator (ID: ${round.transitionModerator.substring(0, 8)}...)` : "(select moderator)"}
            </span>
          )}
          {' '}decides ({conditionsCount} condition{conditionsCount !== 1 ? 's' : ''})
        </>
      )
    case 'user':
    default:
      return (
        <>
          <span className="text-black">Next</span>—user decides
        </>
      )
  }
}

export function ChatRoundItem({
  round,
  isActive,
  onRemove,
  onUpdate,
  onEditParticipants,
  onEditLimit,
  onEditAction,
  onEditStance,
  onEditStyle,
  onEditOptions,
  onEditDataTool: _onEditDataTool,
  onEditDialogueSenders,
  onEditDialogueReceivers,
  onEditDialogue,
  encodeAvatarSvg,
  configId,
}: ChatRoundItemProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [memoryImpact, setMemoryImpact] = useState<{memoriesToDelete: number, memoriesWithReferences: number} | null>(null)
  const [showDataModal, setShowDataModal] = useState(false)
  const [isCopyView, setIsCopyView] = useState(false)
  const [newName, setNewName] = useState(round.name || round.type)
  const [newIcon, setNewIcon] = useState((round as any).icon || '')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = () => {
    // Get the current config's memory settings
    const config = configs.find(c => c.id === configId);
    const impact = analyzeRoundDeletionImpact(config?.memorySettings, round.id);
    
    setMemoryImpact(impact);
    setShowDeleteDialog(true);
    setDropdownOpen(false);
  }
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showRetentionSettingsModal, setShowRetentionSettingsModal] = useState(false)
  const [showPromptsModal, setShowPromptsModal] = useState(false)
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const agents = useChatAgentStore(state => state.agents)
  const hasAgents = agents.length > 0
  const { toast } = useToast()
  const availableModels = useModelsStore(state => state.availableModels)

  const getParticipantSummary = (round: Round, resolvedParticipants: any[], onAgentClick: (agent: ChatAgent) => void) => {
    if (round.participantMode === 'GENERATE') {
      const number = round.participantLength || 3;
      if (round.participantLengthType === 'AI_DECIDES') {
        return (
          <div className="text-sm text-muted-foreground mt-2">
            <span>Generates up to <span className="text-black">{number} new agents</span> via AI prompt.</span>
          </div>
        );
      }
      return (
        <div className="text-sm text-muted-foreground mt-2">
          <span>Generates <span className="text-black">{number} new agents</span> via AI prompt.</span>
        </div>
      );
    }
  
    // Fallback to existing SELECT mode logic
    return (
      <>
        {resolvedParticipants && resolvedParticipants.length > 0 ? (
          <AgentAvatarList
            agents={resolvedParticipants}
            encodeAvatarSvg={encodeAvatarSvg}
            onAgentClick={onAgentClick}
          />
        ) : (
          renderWarningState(hasAgents, "mt-2")
        )}
      </>
    );
  }

  const handleEditAgent = (agent: ChatAgent) => {
    const fullAgent = agents.find(a => a.id === agent.id)
    if (fullAgent) {
      window.dispatchEvent(new CustomEvent('agent:edit', { detail: { agent: fullAgent, isCreating: false } }));
    }
  }

  // Helper function to resolve participant IDs to full agent objects
  const resolveParticipants = useCallback(() => {
    if (!round.participants) return []
    
    return round.participants
      .map(participant => {
        // If participant already has name/avatar properties, return as is
        if (participant.name) return participant
        
        // Otherwise, look up the agent by ID
        const agent = agents.find(a => a.id === participant.id)
        return agent || null
      })
      .filter(Boolean) // Remove null entries
  }, [round.participants, agents])
  
  // Get resolved participants
  const resolvedParticipants = resolveParticipants()
  
  // Get config from the store
  const activeConfig = useConfigsStore(state => state.activeConfig)
  const configs = useConfigsStore(state => state.configs)
  
  // Get config title - first check activeConfig, then search in configs
  const getConfigTitle = useCallback(() => {
    if (activeConfig?.id === configId) {
      return activeConfig.title;
    }
    
    // If not activeConfig, look in all configs
    const config = configs.find(c => c.id === configId);
    return config?.title || "Chat Template";
  }, [activeConfig, configs, configId]);

  const getCreativitySummary = () => {
    if (round.creativityType === "agent") {
      return ''
    }
    if (round.creativityNumber !== undefined) {
      const foundIndex = Object.entries(CREATIVITY_LABELS).find(
        ([_, config]) => config.value === round.creativityNumber
      )?.[0]
      const index = foundIndex !== undefined ? Number(foundIndex) as keyof typeof CREATIVITY_LABELS : 1
      const { label, description } = CREATIVITY_LABELS[index] || CREATIVITY_LABELS[1]
      return (
        <>
          <span className="text-black">{label}</span>
          <span>—{description}</span>
        </>
      )
    }
    return "Use agent defaults"
  }

  // Reset name and icon when dialog opens/closes
  const handleRenameDialogChange = (open: boolean) => {
    setShowRenameDialog(open)
    if (open) {
      setNewName(round.name || round.type)
      setNewIcon((round as any).icon || '')
    }
  }

  const handleRename = async () => {
    if (!newName.trim()) return
    
    setIsRenaming(true)
    try {
      await onUpdate(round.id, { name: newName, icon: newIcon })
      setShowRenameDialog(false)
    } catch (error) {
      console.error('Error renaming round:', error)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleCreateAgents = () => {
    // Dispatch the custom event to open the agent creation panel
    window.dispatchEvent(new CustomEvent('agentsList:createAgent'))
  }

  const getOptionsSummary = (round: Round) => {
    const hasOptions = round.instructions || round.showPrompts || round.agentQuestions || round.agentSelfReflection || 
      round.agentIsolation || round.isPrivate || (round.modelSelectionMode && round.modelSelectionMode !== 'agent')

    if (!hasOptions) {
      return (
        <div className="text-sm text-muted-foreground">
          none
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {round.instructions && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Custom Instructions</span>
          </div>
        )}
        {round.showPrompts && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Show Prompts</span>
          </div>
        )}
        {round.agentQuestions && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Questions Enabled</span>
          </div>
        )}
        {round.agentSelfReflection && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Self-Reflection</span>
          </div>
        )}
        {round.agentIsolation && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Agent Isolation Mode</span>
          </div>
        )}
        {round.isPrivate && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Private Round</span>
          </div>
        )}
        {round.modelSelectionMode && round.modelSelectionMode !== 'agent' && (
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>
              {round.modelSelectionMode === 'random' 
                ? 'Random Model Selection' 
                : round.modelSelectionMode === 'specific' && round.selectedModel
                  ? `Using ${availableModels[round.selectedModel]?.name || 'Specific Model'}`
                  : 'Custom Model Selection'}
            </span>
          </div>
        )}
      </div>
    )
  }

  const getMemorySummary = () => {
    const config = configs.find(c => c.id === configId);
    const memories = config?.memorySettings?.memories || [];
    
    // Find memories that involve this round
    const relevantMemories = memories.filter((memory: { id: string; name: string; memorizeRound: string; memorizeInstructions: string; rememberWhen: string; rememberRounds?: Array<{ roundId: string; instructions: string }>; rememberInstructions?: string; rememberWho: string; updateEnabled: boolean; updateWhen: string; updateRounds?: Array<{ roundId: string; instructions: string }>; updateInstructions?: string; updateWho: string }) => {
      // Memory is memorized in this round
      if (memory.memorizeRound === round.id) return true;

      // Memory is remembered in this round (specific rounds only)
      if (memory.rememberWhen === 'specific_rounds' &&
          memory.rememberRounds?.some((r: { roundId: string }) => r.roundId === round.id)) return true;

      // Memory is updated in this round (specific rounds only)
      if (memory.updateEnabled && memory.updateWhen === 'specific_rounds' &&
          memory.updateRounds?.some((r: { roundId: string }) => r.roundId === round.id)) return true;

      return false;
    });

    if (relevantMemories.length === 0) {
      return null; // Don't show section if no relevant memories
    }

    return (
      <div className="space-y-1">
        {relevantMemories.map((memory: { id: string; name: string; memorizeRound: string; rememberWhen: string; rememberRounds?: Array<{ roundId: string }>; updateEnabled: boolean; updateWhen: string; updateRounds?: Array<{ roundId: string }> }) => (
          <div key={memory.id} className="text-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="font-medium text-black underline hover:no-underline cursor-pointer"
                    onClick={() => setShowMemoryModal(true)}
                  >
                    {memory.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit this memory</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-muted-foreground ml-2">
              {memory.memorizeRound === round.id && '(memorized)'}
              {memory.rememberWhen === 'specific_rounds' &&
               memory.rememberRounds?.some((r: { roundId: string }) => r.roundId === round.id) && '(remembered)'}
              {memory.updateEnabled && memory.updateWhen === 'specific_rounds' &&
               memory.updateRounds?.some((r: { roundId: string }) => r.roundId === round.id) && '(updated)'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Helper function to render warning states
  const renderWarningState = (hasAgents: boolean, additionalClasses: string = "") => {
    if (hasAgents) {
      // Show warning with "Add agents" text
      return (
        <div className={`flex items-center ${additionalClasses}`}>
          <div className="bg-yellow-50 w-6 h-6 rounded-full flex items-center justify-center mr-2">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          </div>
          <div className="text-sm text-muted-foreground">
            Add agents to this round
          </div>
        </div>
      )
    } else {
      // Show warning with clickable "Create agents" link
      return (
        <div className={`flex items-center ${additionalClasses}`}>
          <div className="bg-yellow-50 w-6 h-6 rounded-full flex items-center justify-center mr-2">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          </div>
          <Button
            variant="link"
            className="text-xs p-0 h-auto text-gray-600 hover:text-black"
            onClick={handleCreateAgents}
          >
            Create agents to add to this chat
          </Button>
        </div>
      )
    }
  }

  const renderRoundInputs = () => {
    return (
      <>
        {/* Single Participant Section */}
        {shouldShowInput(round.type, 'participant') && (
          <div className="pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Participant</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditParticipants(round.id)}
              >
                edit
              </Button>
            </div>

            <div className="flex items-center mt-2">
              {resolvedParticipants[0] ? (
                <div 
                  className="flex items-center space-x-2 cursor-pointer"
                  onClick={() => {
                    if (resolvedParticipants[0]) {
                      handleEditAgent(resolvedParticipants[0])
                    }
                  }}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={encodeAvatarSvg(resolvedParticipants[0]?.avatar)} />
                    <AvatarFallback>{resolvedParticipants[0]?.name[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">{resolvedParticipants[0]?.name || 'Select a participant'}</div>
                </div>
              ) : (
                renderWarningState(hasAgents)
              )}
            </div>
          </div>
        )}

        {/* Multiple Participants Section */}
        {shouldShowInput(round.type, 'participants') && (
          <div className="pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Participants</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditParticipants(round.id)}
              >
                edit
              </Button>
            </div>
            {getParticipantSummary(round, resolvedParticipants, handleEditAgent)}
          </div>
        )}

        {/* Dialogue Sections for Dialogue Rounds */}
        {round.type === 'dialogue' && (
          <>
            {/* Senders Section */}
            <div className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Senders</label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEditDialogueSenders(round.id)}
                >
                  edit
                </Button>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {(() => {
                  const summary = getDialogueSendersSummary(round, agents, encodeAvatarSvg)
                  return summary.jsx || summary.text
                })()}
              </div>
            </div>

            {/* Receivers Section */}
            <div className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Receivers</label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEditDialogueReceivers(round.id)}
                >
                  edit
                </Button>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {(() => {
                  const summary = getDialogueReceiversSummary(round, agents, encodeAvatarSvg)
                  return summary.jsx || summary.text
                })()}
              </div>
            </div>

            {/* Dialogue Section */}
            <div className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Dialogue</label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEditDialogue(round.id)}
                >
                  edit
                </Button>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {getDialogueSummary(round)}
              </div>
            </div>
          </>
        )}

        {/* Stance Section */}
        {shouldShowInput(round.type, 'stance') && (
          <div className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Stance</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditStance(round.id)}
              >
                edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {getStanceSummary(round.stanceType)}
            </div>
          </div>
        )}

        {/* Flow Section (Length Limit + Participant Order) */}
        {(shouldShowInput(round.type, 'limitByTotal') || 
          shouldShowInput(round.type, 'limitByRounds')) && (
          <div className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Flow</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditLimit(round.id)}
              >
                edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mt-2 space-y-2">
              <div className="break-normal">{getParticipantOrderSummary(round.participantOrder, round, resolvedParticipants, handleEditAgent)}</div>
              <div className="break-normal">{getLimitSummary(round.lengthType, round.lengthNumber, round.lengthRounds, round, resolvedParticipants, handleEditAgent)}</div>
              <div className="break-normal">{getTransitionSummary(round, resolvedParticipants, handleEditAgent)}</div>
            </div>
          </div>
        )}

        {/* Style Section (Combined Depth and Creativity) */}
        {shouldShowInput(round.type, 'depth') && (
          <div className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Style</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditStyle(round.id)}
              >
                edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mt-2 space-y-2">
              <div className="break-normal">
                {getDepthSummary(round.depth, "")}
              </div>
              <div className="break-normal">
                {getCreativitySummary()}
              </div>
            </div>
          </div>
        )}

        {/* Output Number Section */}
        {shouldShowInput(round.type, 'outputNumber') && (
          <div className="pt-4 pb-4">
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Ideas per Message</label>
              </div>
              <Slider
                value={[round.outputNumber || 3]}
                onValueChange={([value]) => onUpdate(round.id, { outputNumber: value })}
                min={1}
                max={10}
                step={1}
              />
              <div className="text-xs text-muted-foreground pt-2">
                <span className="font-bold text-black">{round.outputNumber || 3}</span>
                <span className="mx-1">—</span>
                <span>{round.outputNumber || 3} ideas per message</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Section for Review Rounds */}
        {round.type === 'review' && (
          <div className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Action</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditAction(round.id)}
              >
                edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {getActionSummary(round.action)}
            </div>
          </div>
        )}

        {/* Data Tool Section */}
        {shouldShowInput(round.type, 'dataTool') && round.dataTool && round.dataTool.parameters && round.dataTool.parameters.length > 0 && (
          <div className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Data</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDataModal(true)}
              >
                edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {getDataToolSummary(round)}
            </div>
          </div>
        )}

        {/* Memory Section */}
        {getMemorySummary() && (
          <div className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Memory</label>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {getMemorySummary()}
            </div>
          </div>
        )}

        {/* Options Section */}
        <div className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Options</label>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onEditOptions(round.id)}
            >
              edit
            </Button>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {getOptionsSummary(round)}
          </div>
        </div>
      </>
    )
  }

  const handleSaveRetentionSettings = (settings: RoundRetentionSettings) => {
    onUpdate(round.id, { retentionSettings: settings });
    setShowRetentionSettingsModal(false);
    toast({
      title: "Settings Saved",
      description: "The retention settings for this round have been updated.",
    });
  };

  return (
    <AccordionItem 
      value={round.id}
      className="rounded-lg bg-card group overflow-hidden border-0"
    >
      <div className="flex justify-between bg-black text-white rounded-lg data-[state=open]:rounded-b-none shadow-sm" data-state={isActive ? 'open' : 'closed'}>
        <AccordionTrigger className="flex-1 grow hover:no-underline h-9 px-2 [&[data-state=open]>div]:text-white [&>svg]:text-white/50 group/trigger [&:hover>svg]:text-white">
          <div className="flex justify-start items-center gap-2 flex-1 mr-1">
            <RoundIcon 
              iconName={(round as any).icon}
              roundType={round.type}
              className="w-4 h-4 text-white" 
            />
            <span className="font-medium text-sm truncate max-w-[160px]">{round.name || round.type}</span>
          </div>
        </AccordionTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "grow-0 shrink transition-opacity h-9 w-9 rounded-none rounded-r-lg text-gray-300 hover:text-white hover:bg-transparent",
                      dropdownOpen || isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black border-gray-800">
                  <DropdownMenuItem 
                    className="text-gray-300 hover:text-white focus:text-white cursor-pointer transition-colors data-[highlighted]:bg-transparent"
                    onClick={() => {
                      setShowRenameDialog(true)
                      setDropdownOpen(false)
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-gray-300 hover:text-white focus:text-white cursor-pointer transition-colors data-[highlighted]:bg-transparent"
                    onClick={() => {
                      setShowPromptsModal(true)
                      setDropdownOpen(false)
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Prompts
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-gray-300 hover:text-white focus:text-white cursor-pointer transition-colors data-[highlighted]:bg-transparent"
                    onClick={() => {
                      setShowDataModal(true)
                      setDropdownOpen(false)
                    }}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Data
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-gray-300 hover:text-white focus:text-white cursor-pointer transition-colors data-[highlighted]:bg-transparent"
                    onClick={() => {
                      setShowRetentionSettingsModal(true)
                      setDropdownOpen(false)
                    }}
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Retention
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-300 hover:text-red-500 focus:text-red-500 cursor-pointer transition-colors data-[highlighted]:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick()
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent>
              <p>Options</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <AccordionContent className="divide-y divide-border px-4 pb-4 [&>div:first-child]:pt-4 border border-t-0 rounded-b-lg">
        {renderRoundInputs()}
      </AccordionContent>

      <Dialog open={showRenameDialog} onOpenChange={handleRenameDialogChange}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Edit Round</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Enter name (defaults to ${round.type})`}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Icon</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowIconPicker(true)}
                  className="flex items-center gap-2"
                >
                  <RoundIcon 
                    iconName={newIcon} 
                    roundType={round.type}
                    className="h-4 w-4" 
                  />
                  {newIcon ? 'Change Icon' : 'Choose Icon'}
                </Button>
                {newIcon && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewIcon('')}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {newIcon ? 'Custom icon selected' : 'Using default icon for round type'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleRenameDialogChange(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !newName.trim() || (newName === round.name && newIcon === (round as any).icon)}
            >
              {isRenaming ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={setNewIcon}
        currentIcon={newIcon}
      />

      {showDeleteDialog && (
        <ConfirmModal
          title="Delete Round"
          message={
            memoryImpact && (memoryImpact.memoriesToDelete > 0 || memoryImpact.memoriesWithReferences > 0)
              ? `Are you sure you want to delete this ${round.type} round?\n\n⚠️ Memory Impact:\n${
                  memoryImpact.memoriesToDelete > 0
                    ? `• ${memoryImpact.memoriesToDelete} ${memoryImpact.memoriesToDelete === 1 ? 'memory will' : 'memories will'} be permanently deleted\n`
                    : ''
                }${
                  memoryImpact.memoriesWithReferences > 0
                    ? `• ${memoryImpact.memoriesWithReferences} ${memoryImpact.memoriesWithReferences === 1 ? 'memory has' : 'memories have'} references that will be removed\n`
                    : ''
                }\nThis action cannot be undone.`
              : `Are you sure you want to delete this ${round.type} round? This action cannot be undone.`
          }
          onConfirm={async () => {
            setIsDeleting(true)
            try {
              await onRemove(round.id)
              setShowDeleteDialog(false)
              setMemoryImpact(null)
            } catch (error) {
              console.error('Error deleting round:', error)
            } finally {
              setIsDeleting(false)
            }
          }}
          onCancel={() => {
            setShowDeleteDialog(false)
            setMemoryImpact(null)
          }}
          isLoading={isDeleting}
          cancelDisabled={isDeleting}
        />
      )}

      <RoundDataModal
        configId={configId}
        configTitle={getConfigTitle()}
        round={round}
        isOpen={showDataModal}
        onClose={() => {
          setShowDataModal(false)
          setIsCopyView(false)
        }}
        onUpdate={onUpdate}
        isCopyView={isCopyView}
      />

      <RoundRetentionSettingsModal
        isOpen={showRetentionSettingsModal}
        onClose={() => setShowRetentionSettingsModal(false)}
        onSave={handleSaveRetentionSettings}
        initialSettings={round.retentionSettings}
        scope="round"
        scopeName={round.name || `Round #${round.sequence + 1}`}
      />

      {/* Prompts View Modal */}
      {showPromptsModal && (
        <PromptsViewModal
          configId={configId}
          roundId={round.id}
          participants={resolvedParticipants || []}
          isOpen={showPromptsModal}
          onClose={() => setShowPromptsModal(false)}
          encodeAvatarSvg={encodeAvatarSvg}
        />
      )}
      
      {/* Memory Modal */}
      <MemoryModal
        configId={configId}
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
      />
    </AccordionItem>
  )
} 