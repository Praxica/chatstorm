import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, ChevronRight, X, Info, Copy } from "lucide-react";
import { type Round } from "@/types/config-round";
import { RoundDataExport } from "@/components/rounds/RoundDataExport";
import { RoundDataTool } from "@/components/rounds/RoundDataTool";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigsStore } from "@/lib/stores/configsStore";
import { ROUND_TYPES } from "@/lib/constants/rounds";
import { RoundDataCopy } from "./RoundDataCopy";

export function RoundDataModal({
  configId,
  configTitle,
  round,
  isOpen,
  onClose,
  onUpdate,
  isCopyView: initialIsCopyView = false,
  exportAllRounds = false,
}: {
  configId: string;
  configTitle: string;
  round: Round;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, config: Partial<Round>) => void;
  isCopyView?: boolean;
  exportAllRounds?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"extract" | "export" | "copy">("extract");
  const [selectedConfigId, setSelectedConfigId] = useState<string>(configId);
  const [selectedRounds, setSelectedRounds] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [, setHasUnsavedChanges] = useState(false);
  const [isCopyView, setIsCopyView] = useState(initialIsCopyView);
  const configs = useConfigsStore(state => state.configs);
  const setConfigs = useConfigsStore(state => state.setConfigs);
  const updateConfig = useConfigsStore(state => state.updateConfig);

  // Fetch all configs when component mounts
  useEffect(() => {
    const fetchConfigs = async () => {
      // Only fetch if configs are not already loaded
      if (configs.length === 0) {
        try {
          const response = await fetch('/api/configs');
          if (!response.ok) throw new Error('Failed to fetch configs');
          const data = await response.json();
          setConfigs(data);
        } catch (error) {
          console.error('Error fetching configs:', error);
        }
      }
    };
    fetchConfigs();
  }, [configs.length, setConfigs]);

  // Reset copy view when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsCopyView(initialIsCopyView);
    }
  }, [isOpen, initialIsCopyView]);

  const handleCopy = async () => {
    if (selectedRounds.length === 0) return;
    
    setIsCopying(true);
    try {
      const response = await fetch(`/api/configs/${configId}/rounds/${round.id}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetRoundIds: selectedRounds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to copy parameters');
      }

      const { updatedRounds } = await response.json();

      // Update the config in the store with the new rounds
      updateConfig(configId, {
        rounds: [
          ...configs.find(c => c.id === configId)?.rounds.filter(
            r => !updatedRounds.some((ur: { id: string }) => ur.id === r.id)
          ) || [],
          ...updatedRounds
        ]
      });

      setCopySuccess(true);
    } catch (error) {
      console.error('Error copying parameters:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const handleReturn = () => {
    setCopySuccess(false);
    setSelectedRounds([]);
    setSelectedConfigId(configId);
  };

  const renderCopyView = () => {
    if (copySuccess) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8">
          <p className="text-lg mb-4">Parameters copied to {selectedRounds.length} round(s)</p>
          <Button onClick={handleReturn}>Return</Button>
        </div>
      );
    }

    const selectedConfig = configs.find(c => c.id === selectedConfigId);
    const availableRounds = selectedConfig?.rounds || [];

    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="pb-3 pt-2 pr-4">
          <p className="text-sm text-muted-foreground">Choose rounds to copy the data parameters to:</p>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column */}
          <div className="w-1/2 border-r p-4 pl-0 flex flex-col min-h-0">
            <div className="mb-3">
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select config" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1 w-full">
              <div className="flex flex-col gap-2 w-full">
                {availableRounds.map(r => {
                  const Icon = ROUND_TYPES[r.type].icon;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                      onClick={() => {
                        if (!selectedRounds.includes(r.id)) {
                          setSelectedRounds([...selectedRounds, r.id]);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm truncate">{r.name || r.type}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right column */}
          <div className="w-1/2 p-4 pr-0 flex flex-col min-h-0">
            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-md mb-4">
              <Info className="h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-700">Extract data from the LLM messages in this round. You can then export this data into CSV and JSON formats. Great for experiments!</p>
            </div>
            <label className="text-base font-medium mb-2 block">Instructions</label>
            <ScrollArea className="flex-1 w-full">
              <div className="flex flex-col gap-2 w-full">
                {selectedRounds.map(roundId => {
                  // Find the round and its config from all configs
                  let targetRound = null;
                  let targetConfig = null;
                  
                  for (const config of configs) {
                    const round = config.rounds.find(r => r.id === roundId);
                    if (round) {
                      targetRound = round;
                      targetConfig = config;
                      break;
                    }
                  }

                  if (!targetRound || !targetConfig) return null;

                  return (
                    <div
                      key={roundId}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md min-w-0 w-full overflow-x-hidden"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm text-gray-500 truncate max-w-[150px]">
                            {targetConfig.title}
                          </span>
                          <span className="text-sm text-gray-400 flex-shrink-0">›</span>
                          <span className="text-sm truncate flex-1">
                            {targetRound.name || targetRound.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRounds(selectedRounds.filter(id => id !== roundId))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="border-t pt-4 flex items-center justify-end gap-2 mt-auto">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={selectedRounds.length === 0 || isCopying}
          >
            {isCopying ? "Copying..." : `Copy these parameters to ${selectedRounds.length} round${selectedRounds.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`top-6 ${exportAllRounds ? "max-w-6xl" : isCopyView ? "max-w-4xl" : activeTab === "extract" ? "max-w-3xl" : "max-w-6xl"} bg-white overflow-hidden flex flex-col h-[calc(100vh-3rem)]`}>
        {exportAllRounds ? (
          <>
            <DialogHeader className="pb-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-4">
                <DialogTitle>
                  <span className="font-normal text-gray-600">{configTitle}</span>
                  <span className="mx-2 text-gray-400">›</span>
                  <span className="font-bold">Export Data</span>
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              <RoundDataExport
                id="data-export-content"
                configId={configId}
                configTitle={configTitle}
                // Pass all rounds for export
                allRounds={true}
              />
            </div>
          </>
        ) : isCopyView ? (
          <>
            <DialogHeader className="pb-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-4">
                <DialogTitle>
                  <span className="font-normal text-gray-600">{configTitle}</span>
                  <span className="mx-2 text-gray-400">›</span>
                  <span className="font-bold">{round.name || round.type}</span>
                  <span className="mx-2 text-gray-400">›</span>
                  <span className="font-bold">Copy Parameters</span>
                </DialogTitle>
              </div>
            </DialogHeader>
            {renderCopyView()}
          </>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "extract" | "export" | "copy")} className="flex-1 flex flex-col">
            <DialogHeader className="pb-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-4">
                <DialogTitle>
                  <span className="font-normal text-gray-600">{configTitle}</span>
                  <span className="mx-2 text-gray-400">›</span>
                  <span className="font-bold">{round.name || round.type}</span>
                </DialogTitle>
                <TabsList className="border-none rounded-none p-0 h-auto ml-2">
                  <TabsTrigger value="extract" className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-primary focus:outline-none focus-visible:outline-none">
                    <Database className="h-4 w-4" />
                    Data
                  </TabsTrigger>
                  <TabsTrigger value="export" className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-primary focus:outline-none focus-visible:outline-none">
                    <FileText className="h-4 w-4" />
                    Export
                  </TabsTrigger>
                  <TabsTrigger value="copy" className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:text-gray-900 data-[state=active]:bg-gray-100 data-[state=active]:text-primary focus:outline-none focus-visible:outline-none">
                    <Copy className="h-4 w-4" />
                    Copy
                  </TabsTrigger>
                </TabsList>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0">
              <TabsContent value="extract" className="h-full m-0">
                <RoundDataTool
                  round={round}
                  isOpen={true}
                  onUpdate={onUpdate}
                  onClose={onClose}
                  onUnsavedChanges={setHasUnsavedChanges}
                />
              </TabsContent>
              <TabsContent value="export" className="h-full m-0">
                <RoundDataExport
                  id="data-export-content"
                  configId={configId}
                  configTitle={configTitle}
                  roundId={round.id}
                />
              </TabsContent>
              <TabsContent value="copy" className="h-full m-0 flex flex-col">
                <RoundDataCopy
                  round={round}
                  onClose={onClose}
                  onCopy={handleCopy}
                  isCopying={isCopying}
                  copySuccess={copySuccess}
                  selectedRounds={selectedRounds}
                  setSelectedRounds={setSelectedRounds}
                  configs={configs}
                  selectedConfigId={selectedConfigId}
                  setSelectedConfigId={setSelectedConfigId}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
} 