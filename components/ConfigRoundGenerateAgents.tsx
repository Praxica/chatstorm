'use client';

import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { type ParticipantMode, type ParticipantLengthType } from '@prisma/client';

export interface GenerationConfig {
  participantMode: ParticipantMode;
  participantGenerationPrompt: string;
  participantLengthType: ParticipantLengthType;
  participantLength: number;
}

interface ConfigRoundGenerateAgentsProps {
  config: Partial<GenerationConfig>;
  onUpdate: (updates: Partial<GenerationConfig>) => void;
}

export function ConfigRoundGenerateAgents({ config, onUpdate }: ConfigRoundGenerateAgentsProps) {
  const participantGenerationPrompt = config.participantGenerationPrompt || '';
  const participantLengthType = config.participantLengthType || 'FIXED';
  const participantLength = config.participantLength || 3;

  const lengthLabel = participantLengthType === 'FIXED'
    ? "Number of agents to create"
    : participantLengthType === 'AI_DECIDES'
    ? "Maximum number of agents"
    : "Number of agents";

  return (
    <div className="space-y-4 p-1">
      <p className="text-sm text-muted-foreground">
        Create new agents for this round using an AI prompt. These agents will only be available for this round.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Number of Agents</label>
        <RadioGroup
          value={participantLengthType}
          onValueChange={(value) => onUpdate({ participantLengthType: value as ParticipantLengthType })}
          className="flex items-center space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="FIXED" id="set" />
            <label htmlFor="set" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Set number</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="AI_DECIDES" id="ai" />
            <label htmlFor="ai" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Let AI decide</label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <label htmlFor="num-agents" className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {lengthLabel}
        </label>
        <Input
          id="num-agents"
          type="number"
          value={participantLength}
          onChange={(e) => onUpdate({ participantLength: Number(e.target.value) })}
          min="1"
          max="20"
          className="w-24"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="generation-prompt" className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Generation Prompt</label>
        <Textarea
          id="generation-prompt"
          placeholder="e.g., 'A panel of experts on climate change from different fields: a scientist, an economist, and a policy maker.'"
          value={participantGenerationPrompt}
          onChange={(e) => onUpdate({ participantGenerationPrompt: e.target.value })}
          rows={4}
          className="max-w-2xl"
        />
      </div>
    </div>
  );
} 