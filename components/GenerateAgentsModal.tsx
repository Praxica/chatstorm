import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

import { CreativitySlider, CREATIVITY_LABELS } from "@/components/ui/creativity-slider"
import { DepthSlider } from "@/components/ui/depth-slider"
import { type DepthLevel } from "@/types/config-round"
import ProjectSelector from "./ProjectSelector"
import { Loader2, CheckCircle, XCircle, X } from "lucide-react"

interface GenerateAgentsModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (count: number, prompt: string, creativity: number, depth: DepthLevel, projectIds: string[]) => Promise<void>
  initialProjectIds?: string[]
}

type ModalState = 'form' | 'generating' | 'success' | 'error'

type AgentStatus = 'pending' | 'generating' | 'completed' | 'failed'

interface AgentProgress {
  name: string
  status: AgentStatus
  attempt: number
  maxAttempts: number
}

interface GenerationProgress {
  total: number
  completed: number
  failed: number
  agentProgress: AgentProgress[]
}

export default function GenerateAgentsModal({ 
  isOpen, 
  onClose, 
  onGenerate, 
  initialProjectIds = [] 
}: GenerateAgentsModalProps) {
  const [count, setCount] = useState(3)
  const [prompt, setPrompt] = useState("")
  const [creativityIndex, setCreativityIndex] = useState(2) // Default to 'Creative'
  const [depth, setDepth] = useState<DepthLevel>('medium')
  const [projectIds, setProjectIds] = useState<string[]>(initialProjectIds)
  
  const [modalState, setModalState] = useState<ModalState>('form')
  const [progress, setProgress] = useState<GenerationProgress>({ total: 0, completed: 0, failed: 0, agentProgress: [] })
  const [errorMessage, setErrorMessage] = useState("")
  const [generationId, setGenerationId] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setModalState('form')
      setProgress({ total: 0, completed: 0, failed: 0, agentProgress: [] })
      setErrorMessage("")
      setGenerationId(null)
    }
  }, [isOpen])

  // Poll for progress when generating
  useEffect(() => {
    if (modalState === 'generating' && generationId) {
      const pollProgress = async () => {
        try {
          const response = await fetch(`/api/agents/generate/${generationId}/progress`)
          if (response.ok) {
            const progressData = await response.json()
            setProgress(progressData)
            
            if (progressData.completed + progressData.failed >= progressData.total) {
              if (progressData.failed === progressData.total) {
                setModalState('error')
                setErrorMessage("All agent generations failed. Please try again.")
              } else if (progressData.failed > 0) {
                setModalState('success')
              } else {
                setModalState('success')
              }
            }
          }
        } catch (error) {
          console.error('Error polling progress:', error)
        }
      }

      const interval = setInterval(pollProgress, 1000)
      return () => clearInterval(interval)
    }
  }, [modalState, generationId])

  const handleGenerate = async () => {
    setModalState('generating')
    setProgress({ total: count, completed: 0, failed: 0, agentProgress: [] })
    
    try {
      const response = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          count, 
          prompt, 
          creativity: CREATIVITY_LABELS[creativityIndex as keyof typeof CREATIVITY_LABELS].value, 
          depth, 
          projectIds 
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start agent generation')
      }

      const result = await response.json()
      setGenerationId(result.generationId)
      
    } catch (error) {
      console.error('Error generating agents:', error)
      setModalState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  const handleClose = () => {
    if (modalState === 'generating') {
      // Don't allow closing while generating
      return
    }
    onClose()
  }

  const handleSuccess = async () => {
    // Get the newly created agents
    const newAgents = await fetch('/api/agents').then(res => res.json())
    const newAgentIds = newAgents
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, progress.completed)
      .map((a: any) => a.id)

    // Dispatch event with the generated agent IDs
    window.dispatchEvent(new CustomEvent('agentsGenerated', {
      detail: { agentIds: newAgentIds }
    }))

    onClose()
    // Trigger any necessary refreshes
    if (onGenerate) {
      // Call the refresh function
      onGenerate(0, '', 0, 'minimal', []).catch(() => {})
    }
  }

  const progressPercentage = progress.total > 0 ? 
    ((progress.completed + progress.failed) / progress.total) * 100 : 0

  const renderFormContent = () => (
    <>
      <DialogHeader className="flex-shrink-0 px-6 pt-6">
        <DialogTitle>Generate Agents</DialogTitle>
        <DialogDescription>
          Generate AI agents with different perspectives and expertise for your discussions.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 py-4 px-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              What type of agents do you want to generate?
            </label>
            <Textarea
              placeholder="E.g. Generate a debate between philosophers with different views on consciousness..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-32 resize-none"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              How many agents?
            </label>
            <Slider
              value={[count]}
              onValueChange={([value]) => setCount(value)}
              min={1}
              max={10}
              step={1}
            />
            <div className="text-sm text-gray-500">
              {count} agent{count > 1 ? 's' : ''}
            </div>
          </div>

          <DepthSlider
            value={depth}
            onChange={setDepth}
            label="Prompt length"
          />

          <CreativitySlider
            value={creativityIndex}
            onChange={setCreativityIndex}
            label="Prompt creativity"
          />

          <ProjectSelector
            selectedProjectIds={projectIds}
            onChange={setProjectIds}
            label="Assign to projects"
          />
        </div>
      </div>

      <DialogFooter className="flex-shrink-0 px-6 pb-6">
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleGenerate}
          disabled={!prompt.trim()}
        >
          Generate Agents
        </Button>
      </DialogFooter>
    </>
  )

    const renderGeneratingContent = () => (
    <>
      <DialogHeader className="flex-shrink-0 px-6 pt-6">
        <DialogTitle>Generating Agents</DialogTitle>
        <DialogDescription>
          Creating {progress.total} agents with unique perspectives...
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 py-4 px-6">
          <div className="flex justify-between text-sm font-medium">
            <span>Progress: {progress.completed + progress.failed} of {progress.total}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="space-y-3 mt-6">
            {progress.agentProgress.map((agent, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{agent.name}</div>
                  {agent.status === 'generating' && agent.attempt > 1 && (
                    <div className="text-xs text-amber-600 mt-1">
                      Retry {agent.attempt} of {agent.maxAttempts}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 ml-3">
                  {agent.status === 'pending' && (
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                  )}
                  {agent.status === 'generating' && (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  )}
                  {agent.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {agent.status === 'failed' && (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {progress.agentProgress.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-gray-600">Preparing to generate agents...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )

  const renderSuccessContent = () => (
    <>
      <DialogHeader className="flex-shrink-0 px-6 pt-6">
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Agents Generated Successfully
        </DialogTitle>
        <DialogDescription>
          {progress.failed > 0 
            ? `${progress.completed} agents were created successfully. ${progress.failed} failed to generate.`
            : `All ${progress.completed} agents were created successfully!`
          }
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 py-8">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Generation Complete</h3>
            <p className="text-gray-600">
              Your new agents are ready to participate in conversations.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter className="flex-shrink-0 px-6 pb-6">
        <Button onClick={handleSuccess}>
          Close
        </Button>
      </DialogFooter>
    </>
  )

  const renderErrorContent = () => (
    <>
      <DialogHeader className="flex-shrink-0 px-6 pt-6">
        <DialogTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-600" />
          Generation Failed
        </DialogTitle>
        <DialogDescription>
          There was an error generating the agents.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 py-8">
          <XCircle className="h-16 w-16 text-red-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Something went wrong</h3>
            <p className="text-gray-600 max-w-md">
              {errorMessage || "An unexpected error occurred while generating agents."}
            </p>
          </div>
        </div>
      </div>

      <DialogFooter className="flex-shrink-0 px-6 pb-6">
        <Button variant="outline" onClick={() => setModalState('form')}>
          Try Again
        </Button>
        <Button onClick={handleClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  )

  const getContent = () => {
    switch (modalState) {
      case 'form':
        return renderFormContent()
      case 'generating':
        return renderGeneratingContent()
      case 'success':
        return renderSuccessContent()
      case 'error':
        return renderErrorContent()
      default:
        return renderFormContent()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="bg-white sm:max-w-2xl max-h-[90vh] flex flex-col p-0"
        onPointerDownOutside={(e) => {
          if (modalState === 'generating') {
            e.preventDefault()
          }
        }}
      >
        {getContent()}
      </DialogContent>
    </Dialog>
  )
} 