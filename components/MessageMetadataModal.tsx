import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot } from "lucide-react";
import { useModelsStore } from '@/lib/stores/modelsStore';

interface MessageMetadataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: any;
  agents?: any[];
  rounds?: any[];
}

// Helper function to get round name
function getRoundName(roundId: string, rounds: any[]): string {
  const round = rounds.find(r => r.id === roundId);
  return round?.name || round?.type || roundId;
}

// Helper function to encode SVG for avatar
function encodeAvatarSvg(svg: string | undefined) {
  try {
    return svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` : ''
  } catch {
    return ''
  }
}

// Helper function to format model display
function formatModelDisplay(modelId: string, availableModels: any) {
  const modelConfig = availableModels[modelId];
  if (modelConfig) {
    const providerLabels: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      groq: 'Groq',
      openrouter: 'OpenRouter'
    };
    const providerLabel = providerLabels[modelConfig.provider] || modelConfig.provider;
    return `${providerLabel} ${modelConfig.name || modelId}`;
  }
  return modelId;
}

export function MessageMetadataModal({
  open,
  onOpenChange,
  message,
  agents,
  rounds = []
}: MessageMetadataModalProps) {
  const availableModels = useModelsStore(state => state.availableModels);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Message Information</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            {/* Timestamp */}
            {message?.metadata?.createdAt && (
              <div>
                <h4 className="font-semibold text-black mb-1">Created At</h4>
                <p className="text-gray-600">
                  {new Date(message.metadata.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZoneName: 'short'
                  })}
                </p>
              </div>
            )}

            {/* Token Usage */}
            {(message?.metadata?.usage || message?.metadata?.totalTokens) && (
              <div>
                <h4 className="font-semibold text-black mb-2">Token Usage</h4>
                <div className="space-y-1 text-gray-600">
                  {message?.metadata?.usage?.promptTokens && (
                    <div className="flex gap-4">
                      <span className="min-w-[140px]">Prompt Tokens:</span>
                      <span className="font-mono text-sm">{message.metadata.usage.promptTokens.toLocaleString()}</span>
                    </div>
                  )}
                  {message?.metadata?.usage?.completionTokens && (
                    <div className="flex gap-4">
                      <span className="min-w-[140px]">Completion Tokens:</span>
                      <span className="font-mono text-sm">{message.metadata.usage.completionTokens.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex gap-4 font-medium text-gray-700">
                    <span className="min-w-[140px]">Total:</span>
                    <span className="font-mono text-sm">
                      {(message?.metadata?.usage?.totalTokens || message?.metadata?.totalTokens || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Model */}
            {message?.metadata?.model && (
              <div>
                <h4 className="font-semibold text-black mb-1">Model</h4>
                <p className="text-gray-600">{formatModelDisplay(message.metadata.model, availableModels)}</p>
              </div>
            )}

            {/* Round */}
            {message?.metadata?.roundId && (
              <div>
                <h4 className="font-semibold text-black mb-1">Round</h4>
                <p className="text-gray-600">
                  {getRoundName(message.metadata.roundId, rounds)}
                </p>
              </div>
            )}

            {/* Agent */}
            {message?.metadata?.agentId && (
              <div>
                <h4 className="font-semibold text-black mb-1">Agent</h4>
                <div className="flex items-center gap-2">
                  {(() => {
                    const messageAgent = agents?.find(a => a.id === message.metadata.agentId);
                    return messageAgent?.avatar ? (
                      <div
                        className="w-5 h-5 rounded-full bg-center bg-cover flex-shrink-0"
                        style={{
                          backgroundImage: `url('${encodeAvatarSvg(messageAgent.avatar)}')`
                        }}
                      />
                    ) : (
                      <Bot className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    );
                  })()}
                  <span className="text-gray-600">
                    {(() => {
                      const messageAgent = agents?.find(a => a.id === message.metadata.agentId);
                      return messageAgent?.name || message.metadata.agentId;
                    })()}
                  </span>
                </div>
              </div>
            )}

            {/* System Prompt */}
            {message?.metadata?.prompts?.system && (
              <div>
                <h4 className="font-semibold text-black mb-2">System Prompt</h4>
                <div className="bg-gray-50 rounded-md p-3">
                  <pre className="whitespace-pre-wrap text-gray-700 font-mono text-xs">
                    {message.metadata.prompts.system}
                  </pre>
                </div>
              </div>
            )}

            {/* Instructions */}
            {message?.metadata?.prompts?.instructions && (
              <div>
                <h4 className="font-semibold text-black mb-2">Instructions</h4>
                <div className="bg-gray-50 rounded-md p-3">
                  <pre className="whitespace-pre-wrap text-gray-700 font-mono text-xs">
                    {message.metadata.prompts.instructions}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}