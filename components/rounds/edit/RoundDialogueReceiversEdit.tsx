import { Textarea } from "@/components/ui/textarea"
import { type RoundDialogueReceiversDraft } from '@/types/config-round'
import { type ChatAgent } from '@/lib/stores/chatAgentStore'
import { AgentSelect } from '../../ui/agent-select'
import { AgentMultiSelect } from '../../ui/agent-multi-select'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface RoundDialogueReceiversEditProps {
  draft: RoundDialogueReceiversDraft
  onUpdateDraft: (updates: Partial<RoundDialogueReceiversDraft>) => void
  participants: ChatAgent[]
  allAgents: ChatAgent[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function RoundDialogueReceiversEdit({
  draft,
  onUpdateDraft,
  participants,
  allAgents,
  encodeAvatarSvg
}: RoundDialogueReceiversEditProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-sm font-semibold">Who will receive messages from each sender?</label>

        <RadioGroup
          value={draft.receiverMode}
          onValueChange={(value: any) => onUpdateDraft({ receiverMode: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all_participants" id="receiver-all" />
            <label htmlFor="receiver-all" className="text-sm cursor-pointer">All participants</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="select" id="receiver-select" />
            <label htmlFor="receiver-select" className="text-sm cursor-pointer">Select specific participants</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="agent_decides" id="receiver-agent" />
            <label htmlFor="receiver-agent" className="text-sm cursor-pointer">Sender decides who receives</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="moderator_decides" id="receiver-moderator" />
            <label htmlFor="receiver-moderator" className="text-sm cursor-pointer">Moderator decides who receives</label>
          </div>
        </RadioGroup>

        {draft.receiverMode === 'select' && (
          <div className="ml-6 space-y-3">
            <label className="text-sm font-semibold">Select Receivers</label>
            <AgentMultiSelect
              agents={participants}
              selectedAgentIds={draft.selectedReceivers}
              onSelectionChange={(ids) => onUpdateDraft({ selectedReceivers: ids })}
              encodeAvatarSvg={encodeAvatarSvg}
              placeholder="Select agents who will receive messages"
            />
          </div>
        )}

        {draft.receiverMode === 'agent_decides' && (
          <div className="ml-6 space-y-3">
            <label className="text-sm font-semibold">Instructions</label>
            <Textarea
              value={draft.receiverInstructions}
              onChange={(e) => onUpdateDraft({ receiverInstructions: e.target.value })}
              placeholder="Instructions for senders on who should receive their messages..."
              rows={3}
            />
          </div>
        )}

        {draft.receiverMode === 'moderator_decides' && (
          <div className="ml-6 space-y-3">
            <label className="text-sm font-semibold">Select Moderator</label>
            <AgentSelect
              value={draft.receiverModeratorAgentId}
              onValueChange={(value) => onUpdateDraft({ receiverModeratorAgentId: value })}
              placeholder="Select moderator agent"
              encodeAvatarSvg={encodeAvatarSvg}
              agents={allAgents}
            />
            <div className="space-y-2">
              <label className="text-sm font-semibold">Instructions</label>
              <Textarea
                value={draft.receiverInstructions}
                onChange={(e) => onUpdateDraft({ receiverInstructions: e.target.value })}
                placeholder="Instructions for the moderator on who should receive messages..."
                rows={3}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
