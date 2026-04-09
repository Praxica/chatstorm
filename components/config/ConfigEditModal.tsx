import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import ProjectSelector from "@/components/ProjectSelector"
import { ConfigService, ConfigUtils } from '@/lib/services/ConfigService'
import { useToast } from "@/components/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useConfigsStore } from '@/lib/stores/configsStore'

interface ConfigEditModalProps {
  configId: string
  isOpen: boolean
  onClose: () => void
  onSave: (newTitle: string, newProjectIds: string[], newInstructions: string, newExamplePrompts: string[], designSettings: any) => void
}

export function ConfigEditModal({ 
  configId, 
  isOpen, 
  onClose, 
  onSave 
}: ConfigEditModalProps) {
  // Get the config directly from the store
  const configs = useConfigsStore(state => state.configs)
  const activeConfig = useConfigsStore(state => state.activeConfig)
  
  // Use config values or fallbacks
  const [newTitle, setNewTitle] = useState('')
  const [newProjectIds, setNewProjectIds] = useState<string[]>([])
  const [newInstructions, setNewInstructions] = useState<string>('')
  const [newExamplePrompts, setNewExamplePrompts] = useState<string[]>([])
  const [showRoundTitles, setShowRoundTitles] = useState(false)
  const [showMessageMetadata, setShowMessageMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  // Update form values when config changes or modal opens
  useEffect(() => {
    if (isOpen) {
      // Find the config using our utility
      const currentConfig = ConfigUtils.findById(configs, activeConfig, configId)
      
      if (currentConfig) {
        setNewTitle(currentConfig.title || '')
        setNewProjectIds(ConfigUtils.getProjectIds(currentConfig))
        setNewInstructions(ConfigUtils.getChatInstructions(currentConfig))
        setNewExamplePrompts(ConfigUtils.getExamplePrompts(currentConfig))
        const designSettings = (currentConfig as any).designSettings || {}
        setShowRoundTitles(designSettings.showRoundTitles || false)
        setShowMessageMetadata(designSettings.showMessageMetadata || false)
      }
    }
  }, [configs, activeConfig, configId, isOpen])

  const handleSave = async () => {
    if (!newTitle.trim()) return
    
    setIsSaving(true)
    try {
      // Create update payload using our utility
      const designSettings = {
        showRoundTitles,
        showMessageMetadata
      };
      
      const updateData = ConfigUtils.createUpdatePayload(
        newTitle,
        newProjectIds,
        newInstructions,
        newExamplePrompts,
        designSettings
      );
      
      await ConfigService.updateConfigViaApi(configId, updateData)
      
      onSave(newTitle, newProjectIds, newInstructions, newExamplePrompts, designSettings)
      onClose()
    } catch (error) {
      console.error('Error updating chat design:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update chat design",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddExamplePrompt = () => {
    if (newExamplePrompts.length < 3) {
      setNewExamplePrompts([...newExamplePrompts, ''])
    }
  }

  const handleRemoveExamplePrompt = (index: number) => {
    setNewExamplePrompts(newExamplePrompts.filter((_, i) => i !== index))
  }

  const handleExamplePromptChange = (index: number, value: string) => {
    const updatedPrompts = [...newExamplePrompts]
    updatedPrompts[index] = value
    setNewExamplePrompts(updatedPrompts)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isSaving) {
        if (!open) {
          onClose()
        }
        // The form values are now set via useEffect when isOpen changes
      }
    }}>
      <DialogContent className="bg-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Chat Design</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(70vh-80px)] overflow-y-auto -mx-6">
          <div className="space-y-6 px-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Name</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter chat design name"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Chat Instructions</label>
              <Textarea
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Enter instructions to display above the chat when starting a new conversation"
                className="w-full min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Example Prompts</label>
              <div className="space-y-2">
                {newExamplePrompts.map((prompt, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={prompt}
                      onChange={(e) => handleExamplePromptChange(index, e.target.value)}
                      placeholder={`Example prompt ${index + 1}`}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveExamplePrompt(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                {newExamplePrompts.length < 3 && (
                  <Button
                    variant="outline"
                    onClick={handleAddExamplePrompt}
                    className="w-full"
                  >
                    Add Example Prompt
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Display Settings</label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showRoundTitles"
                  checked={showRoundTitles}
                  onCheckedChange={(checked) => setShowRoundTitles(checked as boolean)}
                />
                <label
                  htmlFor="showRoundTitles"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Show round titles in chat
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showMessageMetadata"
                  checked={showMessageMetadata}
                  onCheckedChange={(checked) => setShowMessageMetadata(checked as boolean)}
                />
                <label
                  htmlFor="showMessageMetadata"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Show message metadata
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <ProjectSelector
                selectedProjectIds={newProjectIds}
                onChange={setNewProjectIds}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="pt-3 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !newTitle.trim()}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 