import { useState } from 'react'
import { MoreHorizontal, Pencil, Share as ShareIcon, Trash2, Database, Play, Copy, MessageSquare, SlidersHorizontal, Brain } from 'lucide-react'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useConfigsStore } from '@/lib/stores/configsStore'
import { useAppStateStore } from '@/lib/stores/appStateStore'
import { ConfigEditModal } from './ConfigEditModal'
import { ConfigShareModal } from './ConfigShareModal'
import { ConfigBatchModal } from './ConfigBatchModal'
import { ConfigDataExportModal } from './ConfigDataExportModal'
import { ConfigDeleteModal } from './ConfigDeleteModal'
import { ConfigCopyModal } from './ConfigCopyModal'
import { ChatRetentionSettingsModal } from '../retention/ChatRetentionSettingsModal'
import { cn } from '@/lib/utils'
import { useToast } from '../hooks/use-toast'
import { ChatRetentionSettings } from '@/lib/chat/services/retention-types'
import { ConfigService } from '@/lib/services/ConfigService'
import { MemoryModal } from '../memory/MemoryModal'

interface ConfigMenuProps {
  configId: string
  configTitle: string
  onConfigUpdate?: () => void
  onConfigDelete?: () => void
  variant?: 'white' | 'default'
}

export function ConfigMenu({ 
  configId, 
  configTitle, 
  onConfigUpdate, 
  onConfigDelete, 
  variant = 'default' 
}: ConfigMenuProps) {
  const updateConfig = useConfigsStore(state => state.updateConfig)
  const setAppStateConfig = useAppStateStore(state => state.actions.setConfig)
  const config = useConfigsStore(state => state.configs.find(c => c.id === configId))
  const { toast } = useToast()

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showDataExportModal, setShowDataExportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showExportAllModal, setShowExportAllModal] = useState(false)
  const [showRetentionSettingsModal, setShowRetentionSettingsModal] = useState(false)
  const [showMemoryModal, setShowMemoryModal] = useState(false)

  if (!config) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              variant === 'white' ? "text-white hover:text-white hover:bg-transparent" : "text-gray-700 hover:text-gray-900"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowEditModal(true)
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.open(`/chats/${configId}/chat/new`, '_blank')
            }}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            View Chats
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowBatchModal(true)
            }}
          >
            <Play className="h-4 w-4 mr-2" />
            Run Batches
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMemoryModal(true)
            }}
          >
            <Brain className="h-4 w-4 mr-2" />
            Memories
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowExportAllModal(true)
            }}
          >
            <Database className="h-4 w-4 mr-2" />
            Export Data
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowRetentionSettingsModal(true)
            }}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Retention
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowShareModal(true)
            }}
          >
            <ShareIcon className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowCopyModal(true)
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowDeleteModal(true)
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfigEditModal
        configId={configId}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={(newTitle, newProjectIds, newInstructions, newExamplePrompts, designSettings) => {
          const updateData = { 
            title: newTitle,
            projects: newProjectIds.map(id => ({ id })),
            chatInstructions: newInstructions,
            examplePrompts: newExamplePrompts,
            designSettings
          };
          
          // Create the updated config object
          const updatedConfig = { 
            ...config,
            title: newTitle,
            projects: newProjectIds.map(id => ({ id })),
            chatInstructions: newInstructions,
            examplePrompts: newExamplePrompts,
            designSettings
          };
          
          // Update app state first to prevent UI flicker
          setAppStateConfig(updatedConfig);
          
          // Then update the configs store
          updateConfig(configId, updateData);
          
          onConfigUpdate?.()
        }}
      />

      <ConfigShareModal
        configId={configId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      <ConfigBatchModal
        configId={configId}
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
      />

      <ConfigDataExportModal
        config={config}
        isOpen={showDataExportModal}
        onClose={() => setShowDataExportModal(false)}
      />

      <ConfigDataExportModal
        config={config}
        isOpen={showExportAllModal}
        onClose={() => setShowExportAllModal(false)}
        exportAllRounds
      />

      <ConfigDeleteModal
        configId={configId}
        configTitle={configTitle}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => {
          onConfigDelete?.()
        }}
      />

      <ConfigCopyModal
        configId={configId}
        configTitle={configTitle}
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        onCopy={async (_newConfig) => {
          // Reload configs to ensure proper filtering by spaceId
          const loadConfigs = useConfigsStore.getState().loadConfigs
          // Get the spaceId from the config (if it exists)
          await loadConfigs(config.spaceId || undefined)
          // Trigger any parent update callbacks
          onConfigUpdate?.()
        }}
      />

      <ChatRetentionSettingsModal
        isOpen={showRetentionSettingsModal}
        onClose={() => setShowRetentionSettingsModal(false)}
        onSave={async (settings: ChatRetentionSettings) => {
          try {
            const updatedConfig = await ConfigService.updateConfigViaApi(configId, {
              retentionSettings: settings,
            })

            updateConfig(configId, updatedConfig)
            setAppStateConfig(updatedConfig)

            toast({
              title: 'Success',
              description: 'Chat retention settings have been updated.',
            })
          } catch (error) {
            console.error('Error saving chat retention settings:', error)
            toast({
              title: 'Error',
              description: `Could not save settings: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              variant: 'destructive',
            })
          }
        }}
        initialSettings={config.retentionSettings}
        configName={config.title}
      />

      <MemoryModal
        configId={configId}
        roundId=""
        roundName={configTitle}
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
      />
    </>
  )
} 