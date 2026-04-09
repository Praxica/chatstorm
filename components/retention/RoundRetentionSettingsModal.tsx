import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';


import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  DEFAULT_ROUND_RETENTION_SETTINGS,
  type RoundRetentionSettings
} from '@/lib/chat/services/retention-types';

interface RoundRetentionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: RoundRetentionSettings) => void;
  initialSettings?: RoundRetentionSettings | null;
  scope: 'config' | 'round';
  scopeName: string;
}

export function RoundRetentionSettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings,
  scope,
  scopeName,
}: RoundRetentionSettingsModalProps) {
  const [settings, setSettings] = useState<RoundRetentionSettings>(
    DEFAULT_ROUND_RETENTION_SETTINGS
  );

  useEffect(() => {
    // Reset state when the modal is opened with new settings
    if (isOpen) {
      setSettings(initialSettings || DEFAULT_ROUND_RETENTION_SETTINGS);
    }
  }, [initialSettings, isOpen]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handlePolicyChange = (value: string) => {
    const newPolicy = value as RoundRetentionSettings['policy'];
    setSettings(prev => {
      const newSettings = { ...prev, policy: newPolicy };
      // If switching to summarize, ensure summarizer settings exist by re-running through defaults
      if (newPolicy === 'summarize' && !newSettings.summarizer) {
        return DEFAULT_ROUND_RETENTION_SETTINGS;
      }
      return newSettings;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="top-6 max-w-3xl bg-white overflow-hidden flex flex-col h-[calc(100vh-3rem)]">
        <DialogHeader className="pb-3 mr-4 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="flex items-center pr-2">
            <span className="font-normal text-gray-600 truncate max-w-[450px] pr-1">{scopeName}</span>
            <span className="mx-2 text-gray-400">›</span>
            <span className="font-bold">Retention Settings</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-8 py-6 pr-6 pl-1">
            <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-md">
              <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">i</span>
              </div>
              <p className="text-sm text-black">
                Control how this round&apos;s messages are handled when being summarized. Edit this Chat Design&apos;s retention settings to change when past messages are summarized.
              </p>
            </div>
            {/* Retention Policy Section */}
            <div>
              <label className="font-semibold text-lg block border-b border-gray-200 pb-1">Retention Policy</label>
              <div className="text-sm text-muted-foreground mb-4 mt-3">
                How will messages from this {scope} be summarized for future rounds?
              </div>
              <RadioGroup
                value={settings.policy}
                onValueChange={handlePolicyChange}
                className="space-y-3 pt-1"
              >
                {/* Summarize */}
                <div className="flex items-start space-x-3">
                  <div className="flex items-baseline gap-2">
                    <RadioGroupItem value="summarize" id="summarize-radio" />
                    <label htmlFor="summarize-radio" className="font-medium cursor-pointer">
                      Summarize
                    </label>
                    {settings.policy === 'summarize' && (
                      <p className="text-sm text-muted-foreground">
                        - Best for retaining key info while saving tokens.
                      </p>
                    )}
                  </div>
                </div>
                {/* Keep Full Messages */}
                <div className="flex items-start space-x-3">
                  <div className="flex items-baseline gap-2">
                    <RadioGroupItem value="keep_full" id="keep-full-radio" />
                    <label htmlFor="keep-full-radio" className="font-medium cursor-pointer">
                      Keep Full Messages
                    </label>
                    {settings.policy === 'keep_full' && (
                      <p className="text-sm text-muted-foreground">
                        - Uses more tokens and potentially noisier.
                      </p>
                    )}
                  </div>
                </div>
                {/* Ignore */}
                <div className="flex items-start space-x-3">
                  <div className="flex items-baseline gap-2">
                    <RadioGroupItem value="ignore" id="ignore-radio" />
                    <label htmlFor="ignore-radio" className="font-medium cursor-pointer">
                      Ignore
                    </label>
                    {settings.policy === 'ignore' && (
                      <p className="text-sm text-muted-foreground">
                        - Useful if message text has no impact on future rounds.
                      </p>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Summarizer Settings Section (Conditional) */}
            {settings.policy === 'summarize' && (
              <div>
                <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                  <label className="font-semibold text-lg">Summary Policy</label>
                </div>
                <div className="text-sm text-muted-foreground mb-4 mt-3">
                  Define how the AI will generate summaries for this {scope}.
                </div>
                <div className="space-y-6">
                  <div className="grid gap-1">
                    <label className="font-semibold">Length</label>
                    <RadioGroup
                      value={settings.summarizer?.output.type}
                      onValueChange={(value: 'word_count' | 'percentage') => {
                        const newDefaultValue = value === 'word_count' ? 400 : 20;
                        setSettings(prev => ({
                          ...prev,
                          summarizer: { 
                            ...prev.summarizer!, 
                            output: {
                              ...prev.summarizer!.output,
                              type: value,
                              value: newDefaultValue,
                            },
                          },
                        }))
                      }}
                      className="space-y-2 pt-1"
                    >
                      {/* Word Count */}
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="word_count" id="word-count-radio" />
                        <div className="flex items-center gap-2 w-full">
                          <label htmlFor="word-count-radio" className="font-medium text-sm cursor-pointer w-28 shrink-0">
                            Word Count
                          </label>
                          {settings.summarizer?.output.type === 'word_count' && (
                            <Input
                              type="number"
                              placeholder="e.g., 400"
                              value={settings.summarizer?.output.value || 400}
                              onChange={e =>
                                setSettings(prev => ({
                                  ...prev,
                                  summarizer: {
                                    ...prev.summarizer!,
                                    output: {
                                      ...prev.summarizer!.output,
                                      value: parseInt(e.target.value, 10),
                                    },
                                  },
                                }))
                              }
                              className="w-24 text-sm "
                            />
                          )}
                        </div>
                      </div>
                      {/* Percentage */}
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="percentage" id="percentage-radio" />
                        <div className="flex items-center gap-2 w-full">
                          <label htmlFor="percentage-radio" className="font-medium text-sm cursor-pointer w-28 shrink-0">
                            Percentage
                          </label>
                          {settings.summarizer?.output.type === 'percentage' && (
                            <div className="flex items-center gap-4 w-full max-w-xs">
                              <Slider
                                value={[settings.summarizer?.output.value || 20]}
                                onValueChange={([value]) =>
                                  setSettings(prev => ({
                                    ...prev,
                                    summarizer: {
                                      ...prev.summarizer!,
                                      output: {
                                        ...prev.summarizer!.output,
                                        value: value,
                                      },
                                    },
                                  }))
                                }
                                min={5}
                                max={50}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-sm font-semibold w-12 text-right">
                                {settings.summarizer?.output.value || 20}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="prompt" className="font-semibold">
                      Prompt
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Optional instructions for how the AI should generate the summary.
                    </p>
                    <Textarea
                      id="prompt"
                      placeholder="e.g., Summarize the key decisions and outcomes."
                      value={settings.summarizer?.prompt || ''}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          summarizer: { ...prev.summarizer!, prompt: e.target.value },
                        }))
                      }
                      className="min-h-[120px] text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="border-t p-4 flex items-center justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 