import { type Round, type RoundType } from "@/types/config-round";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, X } from "lucide-react";
import { ROUND_TYPES } from "@/lib/constants/rounds";

export function RoundDataCopy({
  round: _round,
  onClose,
  onCopy,
  isCopying,
  copySuccess,
  selectedRounds,
  setSelectedRounds,
  configs,
  selectedConfigId,
  setSelectedConfigId,
}: {
  round: Round;
  onClose: () => void;
  onCopy: () => void;
  isCopying: boolean;
  copySuccess: boolean;
  selectedRounds: string[];
  setSelectedRounds: (rounds: string[]) => void;
  configs: Array<{
    id: string;
    title: string;
    rounds: Array<{
      id: string;
      name?: string;
      type: RoundType;
    }>;
  }>;
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
}) {
  if (copySuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <p className="text mb-4">Parameters copied to {selectedRounds.length} round(s)</p>
        <Button onClick={onClose}>Return</Button>
      </div>
    );
  }

  const selectedConfig = configs.find(c => c.id === selectedConfigId);
  const availableRounds = selectedConfig?.rounds || [];

  return (
    <div className="flex flex-col h-full">
      <div className="pb-1 pt-4 pr-4 flex-shrink-0">
        <p className="text-sm text-muted-foreground">Choose rounds to copy the data parameters to. You can copy to multiple rounds at once.</p>
      </div>

      <div className="flex flex-1 min-h-0"> {/* Container for the two columns */}
        {/* Left column */}
        <div className="w-1/2 border-r p-4 pb-0 pl-0 flex flex-col">
          <div className="mb-3 flex-shrink-0">
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

          <ScrollArea className={`w-full max-h-[calc(100vh-290px)]`}>
            <div className="flex flex-col gap-2 w-full pr-1"> {/* Added pr-1 for scrollbar spacing */}
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
        <div className="w-1/2 p-4 pb-0 pr-0 flex flex-col">
          <div className="mb-3 flex-shrink-0">
            <label className="text-sm font-medium block">Rounds to copy to:</label>
          </div>
          <ScrollArea className={`w-full max-h-[calc(100vh-274px)]`}>
            <div className="flex flex-col gap-2 w-full pr-1"> {/* Added pr-1 for scrollbar spacing */}
              {selectedRounds.map(roundId => {
                let targetRound = null;
                let targetConfig = null;
                for (const config of configs) {
                  const roundInConfig = config.rounds.find(r => r.id === roundId);
                  if (roundInConfig) {
                    targetRound = roundInConfig;
                    targetConfig = config;
                    break;
                  }
                }

                if (!targetRound || !targetConfig) return null;

                return (
                  <div
                    key={roundId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md min-w-0 w-full" 
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm text-gray-500 truncate max-w-[45%]">
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

      <div className="border-t pt-4 flex items-center justify-end gap-2 mt-auto flex-shrink-0 p-4 pb-0">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={onCopy}
          disabled={selectedRounds.length === 0 || isCopying}
        >
          {isCopying ? "Copying..." : `Copy to ${selectedRounds.length} round${selectedRounds.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
} 