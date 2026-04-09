import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle } from 'lucide-react';
import {
  DEFAULT_CHAT_RETENTION_SETTINGS,
  type ChatRetentionSettings,
} from '@/lib/chat/services/retention-types';

export function ChatRetentionSettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings,
  configName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ChatRetentionSettings) => void;
  initialSettings?: ChatRetentionSettings | null;
  configName: string;
}) {
  const [settings, setSettings] = useState<ChatRetentionSettings>(
    initialSettings || DEFAULT_CHAT_RETENTION_SETTINGS
  );

  useEffect(() => {
    // Reset state when the modal is opened with new settings
    setSettings(initialSettings || DEFAULT_CHAT_RETENTION_SETTINGS);
  }, [initialSettings, isOpen]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const isInvalid = settings.summarize.enabled &&
                    settings.ignore.enabled &&
                    settings.ignore.afterRounds <= settings.summarize.afterRounds;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="top-6 max-w-3xl bg-white overflow-hidden flex flex-col h-[calc(100vh-3rem)]">
        <DialogHeader className="pb-3 mr-4 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="flex pr-2 items-center">
            <span className="font-normal text-gray-600 truncate max-w-[450px] pr-1">{configName}</span>
            <span className="mx-2 text-gray-400">›</span>
            <span className="font-bold">Chat Retention Settings</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-8 pb-6 pt-2 pr-6">
            <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-md">
              <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">i</span>
              </div>
              <p className="text-sm text-black">
                Set chat-wide rules for when to summarize or ignore past rounds to manage context and save tokens. These rules work with round-level retention settings.
              </p>
            </div>

            <div className="space-y-6 pl-1">
              {/* Summarize Section */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="summarize-enabled"
                  checked={settings.summarize.enabled}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      summarize: { ...prev.summarize, enabled: !!checked },
                    }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="summarize-enabled" className="font-medium cursor-pointer">
                    Replace messages with summaries
                  </label>
                  {settings.summarize.enabled && (
                    <div className="flex items-center gap-2 mt-2">
                      <span>after the</span>
                      <Input
                        type="number"
                        value={settings.summarize.afterRounds}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            summarize: { ...prev.summarize, afterRounds: parseInt(e.target.value, 10) || 0 },
                          }))
                        }
                        className="w-20 h-8"
                      />
                      <span>latest rounds.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ignore Section */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="ignore-enabled"
                  checked={settings.ignore.enabled}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({
                      ...prev,
                      ignore: { ...prev.ignore, enabled: !!checked },
                    }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="ignore-enabled" className="font-medium cursor-pointer">
                    Ignore messages
                  </label>
                  {settings.ignore.enabled && (
                    <div className="flex items-center gap-2 mt-2">
                      <span>after the</span>
                      <Input
                        type="number"
                        value={settings.ignore.afterRounds}
                        onChange={(e) =>
                          setSettings(prev => ({
                            ...prev,
                            ignore: { ...prev.ignore, afterRounds: parseInt(e.target.value, 10) || 0 },
                          }))
                        }
                        className="w-20 h-8"
                      />
                      <span>latest rounds.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {isInvalid && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm font-medium">
                  &quot;Ignore after&quot; rounds must be greater than &quot;Summarize after&quot; rounds.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t p-4 flex items-center justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isInvalid}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 