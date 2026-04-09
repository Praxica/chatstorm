import { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar"
import { PromptService } from "@/lib/chat/services/prompts"
import { useChatAgentStore } from "@/lib/stores/chatAgentStore"
import { useConfigsStore } from "@/lib/stores/configsStore"
import { CopyIcon, CheckIcon } from 'lucide-react'

interface PromptsViewModalProps {
  isOpen: boolean
  onClose: () => void
  roundId: string
  configId: string
  participants: any[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function PromptsViewModal({
  isOpen,
  onClose,
  roundId,
  configId,
  participants,
  encodeAvatarSvg
}: PromptsViewModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentPrompts, setAgentPrompts] = useState<Record<string, string>>({})
  const [instructionPrompts, setInstructionPrompts] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  
  const agents = useChatAgentStore(state => state.agents)
  const configs = useConfigsStore(state => state.configs)
  
  // Find the active config and round
  const activeConfig = configs.find(c => c.id === configId)
  const activeRound = activeConfig?.rounds.find(r => r.id === roundId)
  
  useEffect(() => {
    // Set the first participant as selected by default
    if (participants.length > 0 && !selectedAgentId) {
      setSelectedAgentId(participants[0].id)
    }
    
    // Generate prompts for all participants
    const generatePrompts = async () => {
      if (activeRound) {
        const agentPromptMap: Record<string, string> = {}
        const instructionPromptMap: Record<string, string> = {}
        
        for (const participant of participants) {
          // Create a mock chat state to pass to the PromptService
          const mockChatState = {
            activeRound: activeRound,
            activeAgent: participant,
            agents: agents,
            rounds: activeConfig?.rounds || [],
            chat: { id: 'mock-chat-id' }, // Add required chat field
            config: activeConfig, // Add required config field
            progress: {
              active: {
                round: { isComplete: false },
                agent: { mode: 'participant' }
              }
            }
          }
          
          // Generate both prompts for this participant using type assertion
          agentPromptMap[participant.id] = await PromptService.getAgentPrompt(mockChatState as any, mockChatState.activeAgent)
          instructionPromptMap[participant.id] = await PromptService.getInstructionsPrompt(mockChatState as any)
        }
        
        setAgentPrompts(agentPromptMap)
        setInstructionPrompts(instructionPromptMap)
      }
    }
    
    generatePrompts()
  }, [participants, roundId, activeRound, agents, selectedAgentId, activeConfig])
  
  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col mt-0 top-8" >
        <DialogHeader className="pb-0">
          <DialogTitle>Agent Prompts</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Agent List */}
          <div className="w-1/4 border-r pr-4 overflow-y-auto">
            {participants.length > 0 ? (
              participants.map(agent => (
                <div 
                  key={agent.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-100 ${selectedAgentId === agent.id ? 'bg-gray-100' : ''}`}
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                    <AvatarFallback>{agent.name[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm font-medium">{agent.name}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 p-2">
                No participants added to this round yet.
              </div>
            )}
          </div>
          
          {/* Prompt Display */}
          <div className="w-3/4 pl-4 flex flex-col overflow-hidden">
            {selectedAgentId && (
              <div className="flex flex-col overflow-y-auto h-[calc(85vh-8rem)]">
                {/* Agent Prompt */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Agent Prompt</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyPrompt(agentPrompts[selectedAgentId])}
                      className="flex items-center gap-1 focus:outline-none"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="border rounded-md p-4 bg-gray-50 mb-6">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {agentPrompts[selectedAgentId] || 'No agent prompt available.'}
                    </pre>
                  </div>
                </div>

                {/* Instructions Prompt */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Instructions Prompt</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyPrompt(instructionPrompts[selectedAgentId])}
                      className="flex items-center gap-1 focus:outline-none"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="border rounded-md p-4 bg-gray-50">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {instructionPrompts[selectedAgentId] || 'No instructions prompt available.'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="pt-2">
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 