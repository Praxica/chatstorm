import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigsStore } from "@/lib/stores/configsStore";

interface Memory {
  id: string;
  name: string;
  
  // When to memorize
  memorizeRound: string; // Round ID where this is first memorized
  memorizeInstructions: string; // Instructions for what to memorize
  
  // When to remember
  rememberWhen: 'every_round' | 'specific_rounds';
  rememberRounds?: Array<{ roundId: string; instructions: string }>; // If specific_rounds
  rememberInstructions?: string; // Default instructions for how to inject
  rememberWho: 'every_agent' | 'original_agent';
  
  // When to update
  updateEnabled: boolean; // Whether memory can be updated
  updateWhen: 'every_round' | 'specific_rounds';
  updateRounds?: Array<{ roundId: string; instructions: string }>; // If specific_rounds
  updateInstructions?: string; // Default instructions for how to update
  updateWho: 'every_agent' | 'original_agent';
}

interface MemoryModalProps {
  configId: string;
  roundId?: string;
  roundName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MemoryModal({
  configId,
  roundName,
  isOpen,
  onClose,
}: MemoryModalProps) {
  const config = useConfigsStore(state => state.configs.find(c => c.id === configId));
  const updateConfig = useConfigsStore(state => state.updateConfig);
  const rounds = config?.rounds || [];
  
  // Initialize memories from config or with default
  const initializeMemories = (): Memory[] => {
    if (config?.memorySettings?.memories) {
      return config.memorySettings.memories;
    }
    // Default memory if none exist
    if (rounds.length > 0) {
      return [{
        id: "1",
        name: "New Memory",
        memorizeRound: rounds[0]?.id || "",
        memorizeInstructions: "",
        rememberWhen: 'every_round' as const,
        rememberWho: 'original_agent' as const,
        updateEnabled: false,
        updateWhen: 'every_round' as const,
        updateRounds: [],
        updateInstructions: "Update with new information as needed",
        updateWho: 'original_agent' as const,
      }];
    }
    return [];
  };

  const [localMemories, setLocalMemories] = useState<Memory[]>(() => initializeMemories());
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedMemory = localMemories.find(m => m.id === selectedMemoryId) || null;

  const handleMemorySelect = (memory: Memory) => {
    setSelectedMemoryId(memory.id);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalMemories(initializeMemories());
      setIsSaving(false);
      setSelectedMemoryId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sync memories with config changes
  useEffect(() => {
    if (config?.memorySettings?.memories) {
      setLocalMemories(config.memorySettings.memories);
    }
  }, [config?.memorySettings]);

  // Auto-select first memory when modal opens
  const localMemoriesLength = localMemories.length;
  useEffect(() => {
    if (isOpen && localMemoriesLength > 0 && !selectedMemoryId) {
      setSelectedMemoryId(localMemories[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, localMemoriesLength, selectedMemoryId]);

  const handleAddNew = () => {
    if (isSaving) return;

    const newMemory: Memory = {
      id: Date.now().toString(),
      name: "New Memory",
      memorizeRound: rounds[0]?.id || "",
      memorizeInstructions: "",
      rememberWhen: 'every_round',
      rememberWho: 'original_agent',
      updateEnabled: false,
      updateWhen: 'every_round',
      updateWho: 'original_agent',
    };

    setLocalMemories([...localMemories, newMemory]);
    setSelectedMemoryId(newMemory.id);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/configs/${config?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memorySettings: { memories: localMemories }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save memory settings');
      }

      // Update store
      updateConfig(config?.id || '', {
        memorySettings: { memories: localMemories }
      });

      // Close modal on success
      onClose();
    } catch (error) {
      console.error('Error saving memory settings:', error);
      // TODO: Show error message to user
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDeleteMemory = () => {
    if (!selectedMemoryId) return;

    const updatedMemories = localMemories.filter(m => m.id !== selectedMemoryId);
    setLocalMemories(updatedMemories);
    setShowDeleteConfirm(false);

    // Select first memory if available
    if (updatedMemories.length > 0) {
      setSelectedMemoryId(updatedMemories[0].id);
    } else {
      setSelectedMemoryId(null);
    }
  };

  const updateSelectedMemory = (updates: Partial<Memory>) => {
    if (!selectedMemoryId) return;

    setLocalMemories(localMemories.map(m =>
      m.id === selectedMemoryId ? { ...m, ...updates } : m
    ));
  };

  // Helper functions for managing round arrays
  const addRememberRound = () => {
    if (!selectedMemory) return;
    const currentRounds = selectedMemory.rememberRounds || [];
    const selectedRoundIds = currentRounds.map(r => r.roundId);
    const firstAvailableRound = rounds.find(round => !selectedRoundIds.includes(round.id));
    const newRound = { roundId: firstAvailableRound?.id || "", instructions: "" };
    updateSelectedMemory({ rememberRounds: [...currentRounds, newRound] });
  };

  const updateRememberRound = (index: number, field: 'roundId' | 'instructions', value: string) => {
    if (!selectedMemory?.rememberRounds) return;
    const updatedRounds = selectedMemory.rememberRounds.map((round, i) =>
      i === index ? { ...round, [field]: value } : round
    );
    updateSelectedMemory({ rememberRounds: updatedRounds });
  };

  const removeRememberRound = (index: number) => {
    if (!selectedMemory?.rememberRounds) return;
    const updatedRounds = selectedMemory.rememberRounds.filter((_, i) => i !== index);
    updateSelectedMemory({ rememberRounds: updatedRounds });
  };

  const addUpdateRound = () => {
    if (!selectedMemory) return;
    const currentRounds = selectedMemory.updateRounds || [];
    const selectedRoundIds = currentRounds.map(r => r.roundId);
    const firstAvailableRound = rounds.find(round => !selectedRoundIds.includes(round.id));
    const newRound = { roundId: firstAvailableRound?.id || "", instructions: "" };
    updateSelectedMemory({ updateRounds: [...currentRounds, newRound] });
  };

  const updateUpdateRound = (index: number, field: 'roundId' | 'instructions', value: string) => {
    if (!selectedMemory?.updateRounds) return;
    const updatedRounds = selectedMemory.updateRounds.map((round, i) =>
      i === index ? { ...round, [field]: value } : round
    );
    updateSelectedMemory({ updateRounds: updatedRounds });
  };

  const removeUpdateRound = (index: number) => {
    if (!selectedMemory?.updateRounds) return;
    const updatedRounds = selectedMemory.updateRounds.filter((_, i) => i !== index);
    updateSelectedMemory({ updateRounds: updatedRounds });
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="top-6 max-w-5xl bg-white overflow-hidden flex flex-col h-[calc(100vh-3rem)]">
        <DialogHeader className="pb-3 border-b border-gray-200 flex-shrink-0">
          <DialogTitle>
            <span className="font-normal text-gray-600">{roundName || "Config"}</span>
            <span className="mx-2 text-gray-400">›</span>
            <span className="font-bold">Memories</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left column - Memory list */}
          <div className="w-1/4 border-r p-4 pl-0 flex flex-col min-h-0">
            <ScrollArea className="flex-1 w-full mb-3">
              <div className="flex flex-col gap-2 w-full pr-4">
                {localMemories.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">No memories created yet</p>
                  </div>
                ) : (
                  localMemories.map((memory) => (
                    <div
                      key={memory.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                        selectedMemoryId === memory.id
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => handleMemorySelect(memory)}
                    >
                      <h4 className="font-medium text-sm truncate">
                        {memory.name}
                      </h4>
                      {selectedMemoryId === memory.id && (
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNew}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Memory
            </Button>
          </div>

          {/* Right column - Memory editor */}
          <div className="flex-1 ml-4 flex flex-col min-h-0">
            {selectedMemory ? (
              <ScrollArea className="flex-1">
                <div className="space-y-6 p-4">
                  {/* Memory Name */}
                  <div className="flex gap-4">
                    <div className="w-24 pt-2">
                      <h3 className="text-sm font-semibold text-gray-700">Memory</h3>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Memory Name</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                onClick={() => setShowDeleteConfirm(true)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete this memory</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        value={selectedMemory.name}
                        onChange={(e) => updateSelectedMemory({ name: e.target.value })}
                        placeholder="Enter memory name..."
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {/* Memorize Section */}
                  <div className="flex gap-4">
                    <div className="w-24 pt-2">
                      <h3 className="text-sm font-semibold text-gray-700">Memorize</h3>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">When is this first memorized?</label>
                        <Select
                          value={selectedMemory.memorizeRound}
                          onValueChange={(value) => updateSelectedMemory({ memorizeRound: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select a round" />
                          </SelectTrigger>
                          <SelectContent>
                            {rounds.map((round) => (
                              <SelectItem key={round.id} value={round.id}>
                                {round.name || round.type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Memorize Instructions</label>
                        <Textarea
                          value={selectedMemory.memorizeInstructions}
                          onChange={(e) => updateSelectedMemory({ memorizeInstructions: e.target.value })}
                          placeholder="Instructions for what to extract from the round messages..."
                          className="min-h-[100px] text-sm bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Update Section */}
                  <div className="flex gap-4">
                    <div className="w-24 pt-2">
                      <h3 className="text-sm font-semibold text-gray-700">Update</h3>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="update-enabled"
                          checked={selectedMemory.updateEnabled}
                          onCheckedChange={(checked) => updateSelectedMemory({ updateEnabled: !!checked })}
                        />
                        <label htmlFor="update-enabled" className="text-sm font-medium">Update this memory</label>
                      </div>

                      {selectedMemory.updateEnabled && (
                        <>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Default update instructions</label>
                            <Textarea
                              value={selectedMemory.updateInstructions || ""}
                              onChange={(e) => updateSelectedMemory({ updateInstructions: e.target.value })}
                              placeholder="Default instructions for how to update this memory (append, replace, etc.)..."
                              className="min-h-[80px] text-sm bg-white"
                            />
                          </div>

                          <div>
                        <label className="text-sm font-medium mb-2 block">When is this memory updated?</label>
                        <RadioGroup
                          value={selectedMemory.updateWhen}
                          onValueChange={(value: 'every_round' | 'specific_rounds') =>
                            updateSelectedMemory({ updateWhen: value })
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="every_round" id="update-every" />
                            <label htmlFor="update-every" className="text-sm">Every round</label>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="specific_rounds" id="update-specific" />
                              <label htmlFor="update-specific" className="text-sm">Specific rounds</label>
                            </div>
                            {selectedMemory.updateWhen === 'specific_rounds' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addUpdateRound}
                                className="text-xs px-2 py-1 h-6"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Round
                              </Button>
                            )}
                          </div>
                        </RadioGroup>

                        {selectedMemory.updateWhen === 'specific_rounds' && (
                          <div className="mt-3 p-3 bg-white rounded border">

                            {selectedMemory.updateRounds?.map((roundItem, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3 space-y-3 mb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium">Round</span>
                                    <Select
                                      value={roundItem.roundId}
                                      onValueChange={(value) => updateUpdateRound(index, 'roundId', value)}
                                    >
                                      <SelectTrigger className="w-48 h-7 text-sm bg-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {rounds.map((round) => {
                                          const isAlreadySelected = selectedMemory.updateRounds?.some(
                                            (item, otherIndex) => item.roundId === round.id && otherIndex !== index
                                          )
                                          return (
                                            <SelectItem 
                                              key={round.id} 
                                              value={round.id}
                                              disabled={isAlreadySelected}
                                            >
                                              {round.name || round.type}
                                              {isAlreadySelected && ' (already selected)'}
                                            </SelectItem>
                                          )
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {(selectedMemory.updateRounds?.length || 0) > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeUpdateRound(index)}
                                      className="text-xs px-2 py-1 h-6 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Update instructions for this round</label>
                                  <Textarea
                                    value={roundItem.instructions}
                                    onChange={(e) => updateUpdateRound(index, 'instructions', e.target.value)}
                                    placeholder="Optional instructions for this round (overrides default)..."
                                    className="min-h-[60px] text-sm bg-white"
                                  />
                                </div>
                              </div>
                            ))}

                            {(!selectedMemory.updateRounds || selectedMemory.updateRounds.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No specific rounds added yet. Click &quot;Add Round&quot; to add specific update instructions for individual rounds.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Who can update it?</label>
                          <RadioGroup
                            value={selectedMemory.updateWho}
                            onValueChange={(value: 'every_agent' | 'original_agent') =>
                              updateSelectedMemory({ updateWho: value })
                            }
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="original_agent" id="update-who-original" />
                              <label htmlFor="update-who-original" className="text-sm">
                                The original agent that created the memory
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="every_agent" id="update-who-every" />
                              <label htmlFor="update-who-every" className="text-sm">Every agent in the round</label>
                            </div>
                          </RadioGroup>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Remember Section */}
                  <div className="flex gap-4">
                    <div className="w-24 pt-2">
                      <h3 className="text-sm font-semibold text-gray-700">Remember</h3>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Default remember instructions</label>
                        <Textarea
                          value={selectedMemory.rememberInstructions || ""}
                          onChange={(e) => updateSelectedMemory({ rememberInstructions: e.target.value })}
                          placeholder="Default instructions for how to inject this memory into prompts..."
                          className="min-h-[80px] text-sm bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">When is this remembered?</label>
                        <RadioGroup
                          value={selectedMemory.rememberWhen}
                          onValueChange={(value: 'every_round' | 'specific_rounds') =>
                            updateSelectedMemory({ rememberWhen: value })
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="every_round" id="remember-every" />
                            <label htmlFor="remember-every" className="text-sm">Every round</label>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="specific_rounds" id="remember-specific" />
                              <label htmlFor="remember-specific" className="text-sm">Specific rounds</label>
                            </div>
                            {selectedMemory.rememberWhen === 'specific_rounds' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addRememberRound}
                                className="text-xs px-2 py-1 h-6"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Round
                              </Button>
                            )}
                          </div>
                        </RadioGroup>

                        {selectedMemory.rememberWhen === 'specific_rounds' && (
                          <div className="mt-3 p-3 bg-white rounded border">

                            {selectedMemory.rememberRounds?.map((roundItem, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3 space-y-3 mb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium">Round</span>
                                    <Select
                                      value={roundItem.roundId}
                                      onValueChange={(value) => updateRememberRound(index, 'roundId', value)}
                                    >
                                      <SelectTrigger className="w-48 h-7 text-sm bg-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {rounds.map((round) => {
                                          const isAlreadySelected = selectedMemory.rememberRounds?.some(
                                            (item, otherIndex) => item.roundId === round.id && otherIndex !== index
                                          )
                                          return (
                                            <SelectItem 
                                              key={round.id} 
                                              value={round.id}
                                              disabled={isAlreadySelected}
                                            >
                                              {round.name || round.type}
                                              {isAlreadySelected && ' (already selected)'}
                                            </SelectItem>
                                          )
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {(selectedMemory.rememberRounds?.length || 0) > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeRememberRound(index)}
                                      className="text-xs px-2 py-1 h-6 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Remember instructions for this round</label>
                                  <Textarea
                                    value={roundItem.instructions}
                                    onChange={(e) => updateRememberRound(index, 'instructions', e.target.value)}
                                    placeholder="Optional instructions for this round (overrides default)..."
                                    className="min-h-[60px] text-sm bg-white"
                                  />
                                </div>
                              </div>
                            ))}

                            {(!selectedMemory.rememberRounds || selectedMemory.rememberRounds.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No specific rounds added yet. Click &quot;Add Round&quot; to add specific remember instructions for individual rounds.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Who remembers it?</label>
                        <RadioGroup
                          value={selectedMemory.rememberWho}
                          onValueChange={(value: 'every_agent' | 'original_agent') =>
                            updateSelectedMemory({ rememberWho: value })
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="original_agent" id="who-original" />
                            <label htmlFor="who-original" className="text-sm">
                              The original agent that created the memory
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="every_agent" id="who-every" />
                            <label htmlFor="who-every" className="text-sm">Every agent in the round</label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p>Select a memory to edit or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 px-4 flex items-center justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    {showDeleteConfirm && (
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Delete Memory</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete the memory &quot;{localMemories.find(m => m.id === selectedMemoryId)?.name}&quot;?</p>
            <p className="text-sm text-muted-foreground mt-2">You can undo this by clicking Cancel in the main modal.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMemory}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
  </>
  );
}