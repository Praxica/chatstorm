import { type Config } from '@/lib/stores/configsStore'
import { type Round } from '@/types/config-round'
import { RoundDataModal } from '@/components/rounds/RoundDataModal'

interface ConfigDataExportModalProps {
  config: Config
  round?: Round
  isOpen: boolean
  onClose: () => void
  exportAllRounds?: boolean
}

export function ConfigDataExportModal({
  config,
  round,
  isOpen,
  onClose,
  exportAllRounds,
}: ConfigDataExportModalProps) {
  // Don't render if config has no rounds
  if (!round && (!config.rounds || config.rounds.length === 0)) {
    return null
  }

  return (
    <RoundDataModal
      configId={config.id}
      configTitle={config.title}
      round={round || config.rounds[0]}
      isOpen={isOpen}
      onClose={onClose}
      onUpdate={() => {}}
      exportAllRounds={exportAllRounds}
    />
  )
} 