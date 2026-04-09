import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar"
import { CheckSquare, Wand2, AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { type Round } from '../../types/config-round'
import { useChatAgentStore, type ChatAgent } from '../../lib/stores/chatAgentStore'
import { cn } from '../../lib/utils'
import ProjectFilter from "../ProjectFilter"
import { useState } from "react"
import { useConfigsStore } from "../../lib/stores/configsStore"
import { AgentSortControl } from "../ui/agent-sort-control"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import { ConfigRoundGenerateAgents, type GenerationConfig } from "../ConfigRoundGenerateAgents"
import { ParticipantMode } from '@prisma/client'
import { RoundPanel } from './RoundPanel'

interface ParticipantsPanelProps {
  round: Round
  isOpen: boolean
  draftParticipants: ChatAgent[]
  generationConfig: Partial<GenerationConfig>
  mode: ParticipantMode
  onUpdateDraft: (participants: ChatAgent[]) => void
  onUpdateGenerationConfig: (config: Partial<GenerationConfig>) => void
  onModeChange: (mode: ParticipantMode) => void
  onSave: () => void
  onClose: () => void
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function ParticipantsPanel({
  round,
  isOpen,
  draftParticipants,
  generationConfig,
  mode,
  onUpdateDraft,
  onUpdateGenerationConfig,
  onModeChange,
  onSave,
  onClose,
  encodeAvatarSvg
}: ParticipantsPanelProps) {
  const activeConfig = useConfigsStore(state => state.activeConfig)
  const getSortedAgents = useChatAgentStore(state => state.getSortedAgents)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    activeConfig?.projects?.map(p => p.id) || []
  );

  // Get sorted agents from store, then filter by selected projects
  const filteredAgents = getSortedAgents().filter((agent: ChatAgent) => {
    if (selectedProjectIds.length === 0) return true;
    return agent.projectIds?.some((id: string) => selectedProjectIds.includes(id)) ?? false;
  });

  const handleSave = () => {
    onSave()
  }

  return (
    <RoundPanel
      title={mode === 'SELECT' ? 'Select Participants' : 'Generate Participants'}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <div className="space-y-6">
        {/* Mode Selection Tabs */}
        <div className="-mt-4 mb-0">
          <Tabs value={mode} onValueChange={(value) => onModeChange(value as ParticipantMode)} className="w-full">
            <TabsList className="grid gap-0 w-full grid-cols-2 h-11 bg-transparent p-0">
              <TabsTrigger
                value="SELECT"
                className="pl-4 pt-2 pb-2 text-sm text-gray-600 rounded-tl-md rounded-tr-none rounded-b-none border-b border-black bg-gray-50 hover:bg-gray-100 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=active]:shadow-none flex items-center gap-2"
              >
                <CheckSquare className="h-4 w-4" />
                Select
              </TabsTrigger>
              <TabsTrigger
                value="GENERATE"
                className="pl-4 pt-2 pb-2 text-sm text-gray-600 rounded-tr-md rounded-tl-none rounded-b-none border-b border-black bg-gray-50 hover:bg-gray-100 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=active]:shadow-none flex items-center gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Generate
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Select Mode Content */}
        <div className={cn(mode === 'SELECT' ? 'block' : 'hidden')}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <ProjectFilter
                selectedProjectIds={selectedProjectIds}
                onChange={setSelectedProjectIds}
              />
              <AgentSortControl />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                size="sm"
                className="h-7 text-xs rounded-full px-3 transition-colors hover:bg-gray-100"
                onClick={() => onUpdateDraft(filteredAgents)}
              >
                Select All
              </Button>
              <Button 
                variant="secondary"
                size="sm"
                className="h-7 text-xs rounded-full px-3 transition-colors hover:bg-gray-100"
                onClick={() => onUpdateDraft([])}
              >
                Clear
              </Button>
            </div>

            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredAgents.map((agent: ChatAgent) => {
                const isSelected = draftParticipants.some(p => p.id === agent.id)
                
                // Check if this agent is selected as sender/receiver but not a participant
                const isSelectedSender = round.dialogueSelectedSenders?.includes(agent.id) || false
                const isSelectedReceiver = round.dialogueSelectedReceivers?.includes(agent.id) || false
                const isInDialogue = (isSelectedSender || isSelectedReceiver) && round.type === 'dialogue'
                const willBeRemoved = isInDialogue && !isSelected
                
                
                return (
                  <div
                    key={agent.id}
                    className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-md cursor-pointer"
                    onClick={() => {
                      const newParticipants = isSelected
                        ? draftParticipants.filter(p => p.id !== agent.id)
                        : [...draftParticipants, agent]
                      onUpdateDraft(newParticipants)
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => { }}
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                      <AvatarFallback>{agent.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm flex-1 flex items-center gap-1">
                      {agent.name}
                      {willBeRemoved && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help relative ml-1">
                                <AlertTriangle className="h-6 w-6 fill-amber-500 hover:fill-amber-600 stroke-none" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-white text-sm font-mono font-semibold pt-1">!</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This agent will be removed as a {isSelectedSender && isSelectedReceiver ? 'sender and receiver' : isSelectedSender ? 'sender' : 'receiver'} when you save this configuration</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredAgents.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  No agents found for the selected projects
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate Mode Content */}
        <div className={cn(mode === 'GENERATE' ? 'block' : 'hidden')}>
          <ConfigRoundGenerateAgents
            config={generationConfig}
            onUpdate={onUpdateGenerationConfig}
          />
        </div>
      </div>
    </RoundPanel>
  )
}