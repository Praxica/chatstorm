import { Textarea } from "@/components/ui/textarea"
import { type RoundDialogueSendersDraft } from '@/types/config-round'
import { type ChatAgent } from '@/lib/stores/chatAgentStore'
import { AgentSelect } from '../../ui/agent-select'
import { AgentMultiSelect } from '../../ui/agent-multi-select'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface RoundDialogueSendersEditProps {
  draft: RoundDialogueSendersDraft
  onUpdateDraft: (updates: Partial<RoundDialogueSendersDraft>) => void
  participants: ChatAgent[]
  allAgents: ChatAgent[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function RoundDialogueSendersEdit({
  draft,
  onUpdateDraft,
  participants,
  allAgents,
  encodeAvatarSvg
}: RoundDialogueSendersEditProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-sm font-semibold">Who can send messages in this dialogue?</label>

        <RadioGroup
          value={draft.senderMode}
          onValueChange={(value: any) => onUpdateDraft({ senderMode: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all_participants" id="sender-all" />
            <label htmlFor="sender-all" className="text-sm cursor-pointer">All participants</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="select" id="sender-select" />
            <label htmlFor="sender-select" className="text-sm cursor-pointer">Select specific participants</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="agent_decides" id="sender-agent" />
            <label htmlFor="sender-agent" className="text-sm cursor-pointer">Active agent decides who sends next</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="moderator_decides" id="sender-moderator" />
            <label htmlFor="sender-moderator" className="text-sm cursor-pointer">Moderator decides who sends</label>
          </div>
        </RadioGroup>

        {draft.senderMode === 'select' && (
          <div className="ml-6 space-y-3">
            <label className="text-sm font-semibold">Select Senders</label>
            <AgentMultiSelect
              agents={participants}
              selectedAgentIds={draft.selectedSenders}
              onSelectionChange={(ids) => onUpdateDraft({ selectedSenders: ids })}
              encodeAvatarSvg={encodeAvatarSvg}
              placeholder="Select agents who can send messages"
            />
          </div>
        )}

        {draft.senderMode === 'agent_decides' && (
          <div className="ml-6 space-y-3">
            <label className="text-sm font-semibold">Instructions</label>
            <Textarea
              value={draft.senderInstructions}
              onChange={(e) => onUpdateDraft({ senderInstructions: e.target.value })}
              placeholder="Instructions for agents on who should send next..."
              rows={3}
            />
          </div>
        )}

        {draft.senderMode === 'moderator_decides' && (
          <div className="ml-6 space-y-3">
            <label className="text-sm font-semibold">Select Moderator</label>
            <AgentSelect
              value={draft.senderModeratorAgentId}
              onValueChange={(value) => onUpdateDraft({ senderModeratorAgentId: value })}
              placeholder="Select moderator agent"
              encodeAvatarSvg={encodeAvatarSvg}
              agents={allAgents}
            />
            <div className="space-y-2">
              <label className="text-sm font-semibold">Instructions</label>
              <Textarea
                value={draft.senderInstructions}
                onChange={(e) => onUpdateDraft({ senderInstructions: e.target.value })}
                placeholder="Instructions for the moderator on who should send messages..."
                rows={3}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
