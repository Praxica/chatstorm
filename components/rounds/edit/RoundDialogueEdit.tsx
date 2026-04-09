import { Textarea } from "@/components/ui/textarea"
import { type RoundDialogueDraft } from '@/types/config-round'
import { type ChatAgent } from '@/lib/stores/chatAgentStore'
import { AgentSelect } from '../../ui/agent-select'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"

interface RoundDialogueEditProps {
  draft: RoundDialogueDraft
  onUpdateDraft: (updates: Partial<RoundDialogueDraft>) => void
  agents: ChatAgent[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function RoundDialogueEdit({
  draft,
  onUpdateDraft,
  agents,
  encodeAvatarSvg
}: RoundDialogueEditProps) {
  return (
    <div className="space-y-6">
      {/* Initial Message Section */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Initial Message Prompt</label>

        <RadioGroup
          value={draft.initialMessageMode}
          onValueChange={(value: 'manual' | 'generate') => onUpdateDraft({ initialMessageMode: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="manual" id="initial-manual" />
            <label htmlFor="initial-manual" className="text-sm cursor-pointer">Manual</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="generate" id="initial-generate" />
            <label htmlFor="initial-generate" className="text-sm cursor-pointer">Generate with AI</label>
          </div>
        </RadioGroup>

        {draft.initialMessageMode === 'manual' && (
          <Textarea
            value={draft.initialMessage}
            onChange={(e) => onUpdateDraft({ initialMessage: e.target.value })}
            placeholder="Enter the initial message to start the dialogue..."
            rows={3}
          />
        )}

        {draft.initialMessageMode === 'generate' && (
          <Textarea
            value={draft.initialMessageInstructions}
            onChange={(e) => onUpdateDraft({ initialMessageInstructions: e.target.value })}
            placeholder="Instructions for generating the initial message..."
            rows={3}
          />
        )}
      </div>

      {/* Dialogue Instructions Section */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Dialogue Instructions</label>

        <RadioGroup
          value={draft.dialogueInstructionsMode}
          onValueChange={(value: 'manual' | 'generate') => onUpdateDraft({ dialogueInstructionsMode: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="manual" id="instructions-manual" />
            <label htmlFor="instructions-manual" className="text-sm cursor-pointer">Manual</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="generate" id="instructions-generate" />
            <label htmlFor="instructions-generate" className="text-sm cursor-pointer">Generate with AI</label>
          </div>
        </RadioGroup>

        {draft.dialogueInstructionsMode === 'manual' && (
          <Textarea
            value={draft.dialogueInstructions}
            onChange={(e) => onUpdateDraft({ dialogueInstructions: e.target.value })}
            placeholder="Enter instructions for the dialogue participants..."
            rows={4}
          />
        )}

        {draft.dialogueInstructionsMode === 'generate' && (
          <Textarea
            value={draft.dialogueInstructionsPrompt}
            onChange={(e) => onUpdateDraft({ dialogueInstructionsPrompt: e.target.value })}
            placeholder="Prompt for generating dialogue instructions..."
            rows={4}
          />
        )}
      </div>

      {/* Dialogue Length Section */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Dialogue Length</label>

        <RadioGroup
          value={draft.dialogueLengthMode}
          onValueChange={(value: 'fixed' | 'agent_decides' | 'moderator_decides') => onUpdateDraft({ dialogueLengthMode: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fixed" id="length-fixed" />
            <label
              htmlFor="length-fixed"
              className="text-sm cursor-pointer flex-1"
              onClick={() => onUpdateDraft({ dialogueLengthMode: 'fixed' })}
            >
              Fixed number of messages
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="agent_decides" id="length-agent" />
            <label
              htmlFor="length-agent"
              className="text-sm cursor-pointer flex-1"
              onClick={() => onUpdateDraft({ dialogueLengthMode: 'agent_decides' })}
            >
              Agents decide when to end
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="moderator_decides" id="length-moderator" />
            <label
              htmlFor="length-moderator"
              className="text-sm cursor-pointer flex-1"
              onClick={() => onUpdateDraft({ dialogueLengthMode: 'moderator_decides' })}
            >
              Moderator decides when to end
            </label>
          </div>
        </RadioGroup>

        {draft.dialogueLengthMode === 'fixed' && (
          <div className="space-y-2">
            <label className="text-sm">Number of messages</label>
            <Input
              type="number"
              value={draft.dialogueLength}
              onChange={(e) => onUpdateDraft({ dialogueLength: parseInt(e.target.value) || 10 })}
              min="1"
              max="100"
            />
          </div>
        )}

        {draft.dialogueLengthMode === 'moderator_decides' && (
          <div className="space-y-3">
            <label className="text-sm font-semibold">Select Moderator</label>
            <AgentSelect
              value={draft.dialogueLengthModeratorAgentId}
              onValueChange={(value) => onUpdateDraft({ dialogueLengthModeratorAgentId: value })}
              placeholder="Select moderator agent"
              encodeAvatarSvg={encodeAvatarSvg}
              agents={agents}
            />
          </div>
        )}

        {draft.dialogueLengthMode !== 'fixed' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm">Maximum messages (safety limit)</label>
              <Input
                type="number"
                value={draft.dialogueLength}
                onChange={(e) => onUpdateDraft({ dialogueLength: parseInt(e.target.value) || 10 })}
                min="1"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Instructions</label>
              <Textarea
                value={draft.dialogueLengthInstructions}
                onChange={(e) => onUpdateDraft({ dialogueLengthInstructions: e.target.value })}
                placeholder={
                  draft.dialogueLengthMode === 'agent_decides'
                    ? "Instructions for agents on when to end the dialogue..."
                    : "Instructions for the moderator on when to end the dialogue..."
                }
                rows={3}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
