

import { BatchModal } from '@/components/BatchModal'

interface ConfigBatchModalProps {
  configId: string
  isOpen: boolean
  onClose: () => void
}

export function ConfigBatchModal({ configId, isOpen, onClose }: ConfigBatchModalProps) {
  return (
    <BatchModal
      configId={configId}
      isOpen={isOpen}
      onClose={onClose}
    />
  )
} 