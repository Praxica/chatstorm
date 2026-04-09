import { type Round, type LengthType, type ParticipantOrder, type TransitionType, type RoundFlowDraft, shouldShowInput } from '../../../types/config-round'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "../../ui/input"
import { Textarea } from "../../ui/textarea"
import { Button } from "../../ui/button"
import { type ChatAgent } from '../../../lib/stores/chatAgentStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { AgentSelect } from '../../ui/agent-select'

interface RoundFlowEditProps {
  round: Round
  draft: RoundFlowDraft
  onUpdateDraft: (updates: Partial<RoundFlowDraft>) => void
  agents?: ChatAgent[]
  rounds?: Round[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function RoundFlowEdit({ round, draft, onUpdateDraft, agents = [], rounds = [], encodeAvatarSvg }: RoundFlowEditProps) {
  return (
    <div className="space-y-6">
      {/* Message Senders - only show for non-dialogue rounds */}
      {round.type !== 'dialogue' && (
        <div className="space-y-3">
          <label className="text-sm font-semibold">Who can send messages?</label>
          <RadioGroup
            value={draft.messageSenderMode}
            onValueChange={(value: 'all_participants' | 'moderator_decides') => onUpdateDraft({ messageSenderMode: value })}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all_participants" id="sender-all" />
              <label htmlFor="sender-all" className="text-sm font-medium leading-none">All participants</label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="moderator_decides" id="sender-moderator" />
              <label htmlFor="sender-moderator" className="text-sm font-medium leading-none">Moderator decides</label>
            </div>
          </RadioGroup>

          {draft.messageSenderMode === 'moderator_decides' && (
            <div className="ml-6 space-y-3">
              <div>
                <label className="text-sm font-medium">Moderator Agent</label>
                <AgentSelect
                  value={draft.messageSenderModerator}
                  onValueChange={(value) => onUpdateDraft({ messageSenderModerator: value })}
                  placeholder="Select moderator agent"
                  encodeAvatarSvg={encodeAvatarSvg}
                  agents={agents}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instructions</label>
                <Textarea
                  value={draft.messageSenderInstructions}
                  onChange={(e) => onUpdateDraft({ messageSenderInstructions: e.target.value })}
                  placeholder="Instructions for the moderator on who should send messages and when..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Participant Order */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Participant Order</label>
        <RadioGroup
          value={draft.participantOrder}
          onValueChange={(value: ParticipantOrder) => onUpdateDraft({ participantOrder: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="default" id="order-default" />
            <label htmlFor="order-default" className="text-sm font-medium leading-none">Default</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="random" id="order-random" />
            <label htmlFor="order-random" className="text-sm font-medium leading-none">Random</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="handoff" id="order-handoff" />
            <label htmlFor="order-handoff" className="text-sm font-medium leading-none">Let the active agent decide</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="moderator" id="order-moderator" />
            <label htmlFor="order-moderator" className="text-sm font-medium leading-none">Let a moderator decide</label>
          </div>
        </RadioGroup>

        {draft.participantOrder === 'moderator' && (
          <div className="ml-6 space-y-3">
            <div>
              <label className="text-sm font-medium">Moderator Agent</label>
              <AgentSelect
                value={draft.moderatorAgentId}
                onValueChange={(value) => onUpdateDraft({ moderatorAgentId: value })}
                placeholder="Select moderator agent"
                encodeAvatarSvg={encodeAvatarSvg}
                agents={agents}
              />
            </div>
          </div>
        )}
      </div>

      {/* Length Control */}
      {(shouldShowInput(round.type, 'limitByTotal') || shouldShowInput(round.type, 'limitByRounds')) && (
        <div className="space-y-3">
          <label className="text-sm font-semibold">End the round</label>
          <RadioGroup
            value={draft.lengthType || 'rounds'}
            onValueChange={(value: LengthType) => onUpdateDraft({ lengthType: value })}
            className="space-y-2"
          >
            {shouldShowInput(round.type, 'limitByTotal') && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total" id="length-total" />
                <label htmlFor="length-total" className="text-sm font-medium leading-none">After total number of messages</label>
              </div>
            )}
            {shouldShowInput(round.type, 'limitByRounds') && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rounds" id="length-rounds" />
                <label htmlFor="length-rounds" className="text-sm font-medium leading-none">After number per participant</label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="moderator" id="length-moderator" />
              <label htmlFor="length-moderator" className="text-sm font-medium leading-none">After a moderator decides</label>
            </div>
          </RadioGroup>

          {draft.lengthType === 'rounds' && (
            <div className="ml-6">
              <label className="text-sm font-medium">Messages per participant</label>
              <Input
                type="number"
                min="1"
                value={draft.lengthRounds || 1}
                onChange={(e) => onUpdateDraft({ lengthRounds: parseInt(e.target.value) || 1 })}
              />
            </div>
          )}

          {draft.lengthType === 'total' && (
            <div className="ml-6">
              <label className="text-sm font-medium">Total messages</label>
              <Input
                type="number"
                min="1"
                value={draft.lengthNumber || 1}
                onChange={(e) => onUpdateDraft({ lengthNumber: parseInt(e.target.value) || 1 })}
              />
            </div>
          )}

          {draft.lengthType === 'moderator' && (
            <div className="ml-6 space-y-3">
              <div>
                <label className="text-sm font-medium">Max messages</label>
                <Input
                  type="number"
                  min="1"
                  value={draft.lengthNumber || 10}
                  onChange={(e) => onUpdateDraft({ lengthNumber: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Moderator Agent</label>
                <AgentSelect
                  value={draft.lengthModerator}
                  onValueChange={(value) => onUpdateDraft({ lengthModerator: value })}
                  placeholder="Select moderator agent"
                  encodeAvatarSvg={encodeAvatarSvg}
                  agents={agents}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instructions</label>
                <Textarea
                  value={draft.lengthPrompt}
                  onChange={(e) => onUpdateDraft({ lengthPrompt: e.target.value })}
                  placeholder="Instructions for the moderator on when to end the round..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transition */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Transition</label>
        <RadioGroup
          value={draft.transition}
          onValueChange={(value: TransitionType) => onUpdateDraft({ transition: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="user" id="transition-user" />
            <label htmlFor="transition-user" className="text-sm font-medium leading-none">Pause for the user to start the next round</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="transition-auto" />
            <label htmlFor="transition-auto" className="text-sm font-medium leading-none">Automatically start the next round</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="conditional" id="transition-conditional" />
            <label htmlFor="transition-conditional" className="text-sm font-medium leading-none">Let a moderator decide the next round</label>
          </div>
        </RadioGroup>

        {draft.transition === 'conditional' && (
          <div className="ml-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Moderator Agent</label>
              <AgentSelect
                value={draft.transitionModerator}
                onValueChange={(value) => onUpdateDraft({ transitionModerator: value })}
                placeholder="Select moderator agent"
                encodeAvatarSvg={encodeAvatarSvg}
                agents={agents}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Instructions</label>
              <Textarea
                value={draft.transitionPrompt}
                onChange={(e) => onUpdateDraft({ transitionPrompt: e.target.value })}
                placeholder="Instructions for the moderator on how to choose the next round..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Conditions</label>
              <div className="space-y-3">
                {draft.transitionConditions.map((condition, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Go to</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newConditions = draft.transitionConditions.filter((_, i) => i !== index)
                            onUpdateDraft({ transitionConditions: newConditions })
                          }}
                          className="text-gray-500 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                      <Select
                        value={condition.roundId}
                        onValueChange={(value) => {
                          const newConditions = [...draft.transitionConditions]
                          newConditions[index] = { ...condition, roundId: value }
                          onUpdateDraft({ transitionConditions: newConditions })
                        }}
                      >
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue placeholder="Select round" />
                        </SelectTrigger>
                        <SelectContent>
                          {rounds
                            .map((r) => {
                              // Find the position in the full sorted rounds array
                              const position = rounds.findIndex(round => round.id === r.id) + 1
                              return (
                                <SelectItem key={r.id} value={r.id}>
                                  {position}. {r.name || `${r.type} round`}
                                </SelectItem>
                              )
                            })}
                        </SelectContent>
                      </Select>
                      <div className="space-y-1">
                        <span className="text-sm font-medium">When</span>
                        <Textarea
                          value={condition.condition}
                          onChange={(e) => {
                            const newConditions = [...draft.transitionConditions]
                            newConditions[index] = { ...condition, condition: e.target.value }
                            onUpdateDraft({ transitionConditions: newConditions })
                          }}
                          placeholder="this condition is true"
                          rows={2}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const newConditions = [...draft.transitionConditions, { roundId: '', condition: '' }]
                    onUpdateDraft({ transitionConditions: newConditions })
                  }}
                  className="w-full"
                >
                  Add condition
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
