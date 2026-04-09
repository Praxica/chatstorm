import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, InfoIcon, HelpCircle, ArrowDown, ArrowUp } from "lucide-react";
import { getRoundName } from '@/lib/utils/rounds';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AgentInfo {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
}

interface RoundInfo {
  id: string;
  name?: string;
  type: string;
  sequence: number;
}

interface BatchInfo {
  id: string;
  name: string;
  createdAt: string;
}

interface DataValue {
  id: string;
  messageId: string;
  roundId: string | null;
  batchId?: string | null;
  name: string;
  dataType: string;
  value: any;
  createdAt: string;
  message?: {
    content: string;
    agentId?: string;
    agent?: AgentInfo;
  };
  round?: RoundInfo;
  batch?: BatchInfo;
}

type SortOption = 'parameter-asc' | 'parameter-desc' | 'date-newest' | 'date-oldest' | 'agent' | 'none';

export function RoundDataExport({
  configId,
  configTitle,
  roundId,
  batchId,
  onExportButtonsVisible,
  id: _id,
  allRounds = false,
}: {
  configId: string;
  configTitle: string;
  roundId?: string;
  batchId?: string;
  onExportButtonsVisible?: (visible: boolean) => void;
  id?: string;
  allRounds?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [dataValues, setDataValues] = useState<DataValue[]>([]);
  const [filteredValues, setFilteredValues] = useState<DataValue[]>([]);
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [filter, setFilter] = useState({
    paramName: "all",
    dataType: "all",
    roundId: roundId || "all",
    batchId: batchId || "all",
    sortBy: "date-newest" as SortOption
  });
  const [error, setError] = useState<string | null>(null);

  // Update filter.roundId when roundId prop changes
  useEffect(() => {
    if (roundId) {
      setFilter(prev => ({ ...prev, roundId }));
    }
  }, [roundId]);

  // Update filter.batchId when batchId prop changes
  useEffect(() => {
    if (batchId) {
      setFilter(prev => ({ ...prev, batchId }));
    }
  }, [batchId]);

  // Fetch data when component mounts
  useEffect(() => {
    console.log(`RoundDataExport: Fetching data with configId=${configId}, roundId=${allRounds ? 'all' : (roundId || 'all')}, batchId=${batchId || 'all'}`);
    fetchData();

    // Always fetch rounds data, regardless of whether we have a roundId
    fetchRounds();
    fetchBatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, roundId, batchId, allRounds]);

  // Apply filters whenever they change
  useEffect(() => {
    if (dataValues.length === 0) {
      setFilteredValues([]);
      return;
    }

    let filtered = [...dataValues];

    // Apply parameter filter
    if (filter.paramName && filter.paramName !== "all") {
      filtered = filtered.filter((item) => item.name === filter.paramName);
    }

    // Apply round filter
    if (filter.roundId && filter.roundId !== "all") {
      filtered = filtered.filter((item) => item.roundId === filter.roundId);
    }

    // Apply batch filter
    if (filter.batchId && filter.batchId !== "all") {
      filtered = filtered.filter((item) => item.batchId === filter.batchId);
    }

    // Apply data type filter (keep this for advanced filtering if needed)
    if (filter.dataType && filter.dataType !== "all") {
      filtered = filtered.filter((item) => item.dataType === filter.dataType);
    }

    // Apply sorting
    if (filter.sortBy !== 'none') {
      filtered = sortDataValues(filtered, filter.sortBy);
    }

    setFilteredValues(filtered);
  }, [dataValues, filter]);

  // Notify parent about export buttons visibility
  useEffect(() => {
    if (onExportButtonsVisible) {
      onExportButtonsVisible(filteredValues.length > 0);
    }
  }, [filteredValues.length, onExportButtonsVisible]);

  const sortDataValues = (values: DataValue[], sortOption: SortOption): DataValue[] => {
    const sorted = [...values];

    switch (sortOption) {
      case 'parameter-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'parameter-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'date-newest':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'date-oldest':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'agent':
        sorted.sort((a, b) => {
          const agentNameA = a.message?.agent?.name || '';
          const agentNameB = b.message?.agent?.name || '';
          return agentNameA.localeCompare(agentNameB);
        });
        break;
      default:
        // 'none' - no sorting applied
        break;
    }

    return sorted;
  };

  const fetchRounds = async () => {
    try {
      const response = await fetch(`/api/configs/${configId}/rounds`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch rounds: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Sort rounds by sequence
      const sortedRounds = data.sort((a: RoundInfo, b: RoundInfo) => a.sequence - b.sequence);
      setRounds(sortedRounds);
      
      console.log(`Fetched ${sortedRounds.length} rounds`);
    } catch (error) {
      console.error("Error fetching rounds:", error);
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await fetch(`/api/configs/${configId}/batches`);
      
      if (response.status === 404) {
        // API endpoint doesn't exist yet, just set empty batches and continue
        console.log("Batches API endpoint not available yet");
        setBatches([]);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch batches: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Sort batches by creation date (newest first)
      const sortedBatches = data.sort((a: BatchInfo, b: BatchInfo) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setBatches(sortedBatches);
      console.log(`Fetched ${sortedBatches.length} batches`);
    } catch (error) {
      console.error("Error fetching batches:", error);
      // Don't break the UI when batches can't be fetched
      setBatches([]);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!configId) {
        throw new Error("Missing configId");
      }
      
      const url = allRounds
        ? `/api/configs/${configId}/data-values`
        : roundId 
          ? `/api/configs/${configId}/rounds/${roundId}/data-values`
          : `/api/configs/${configId}/data-values`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Received data:", data.length, "items");
      if (data.length > 0) {
        console.log("First item sample:", {
          name: data[0].name,
          roundId: data[0].roundId,
          batchId: data[0].batchId,
          agent: data[0].message?.agent ? "present" : "missing"
        });
      }
      
      setDataValues(data);
      setFilteredValues(sortDataValues(data, filter.sortBy));
    } catch (error) {
      console.error("Error fetching data values:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      setDataValues([]);
      setFilteredValues([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique parameter names and data types for filters
  const parameterNames = [...new Set(dataValues.map((item) => item.name))];

  // Get unique round names for filter

  // Get batch name for display
  const getBatchName = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return `Batch ${batchId.substring(0, 5)}...`;
    return batch.name;
  };

  const exportCSV = () => {
    if (filteredValues.length === 0) return;

    // Build CSV content
    const headers = ["Parameter", "Value", "Round", "Batch", "Created At", "Agent", "Message Preview"];
    const csvContent = [
      headers.join(","),
      ...filteredValues.map((item) => {
        // Format the value based on type
        let valueStr = "";
        if (typeof item.value === "object") {
          valueStr = `"${JSON.stringify(item.value).replace(/"/g, '""')}"`;
        } else {
          valueStr = `"${String(item.value).replace(/"/g, '""')}"`;
        }

        const messagePreview = item.message?.content
          ? `"${String(item.message.content).substring(0, 100).replace(/"/g, '""')}..."`
          : "";
          
        const agentName = item.message?.agent?.name || "Unknown";
        const agentRole = item.message?.agent?.role || "";
        
        const roundName = item.roundId ? getRoundName(item.roundId, rounds, { useShortFallback: true, includeSequence: true }) : "";
        const batchName = item.batchId ? getBatchName(item.batchId) : "";

        return [
          item.name,
          valueStr,
          `"${roundName}"`,
          `"${batchName}"`,
          new Date(item.createdAt).toLocaleString(),
          `"${agentName}${agentRole ? ` (${agentRole})` : ''}"`,
          messagePreview,
        ].join(",");
      }),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `data-export-${configTitle.replace(/[^\w-]/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (filteredValues.length === 0) return;

    const jsonData = filteredValues.map((item) => ({
      id: item.id,
      name: item.name,
      value: item.value,
      roundId: item.roundId,
      roundName: item.roundId ? getRoundName(item.roundId, rounds, { useShortFallback: true, includeSequence: true }) : null,
      batchId: item.batchId,
      batchName: item.batchId ? getBatchName(item.batchId) : null,
      createdAt: item.createdAt,
      agent: item.message?.agent ? {
        id: item.message.agent.id,
        name: item.message.agent.name,
        role: item.message.agent.role
      } : null,
      messagePreview: item.message?.content
        ? String(item.message.content).substring(0, 100) + "..."
        : null
    }));

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `data-export-${configTitle.replace(/[^\w-]/g, '-')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format value for display based on type
  const formatValue = (value: any, dataType: string) => {
    if (value === null || value === undefined) return "—";

    if (dataType === "boolean") {
      return value ? "True" : "False";
    }

    if (["array_string", "array_number", "keyvalue"].includes(dataType)) {
      return (
        <div className="max-w-[200px] overflow-auto">
          <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>
        </div>
      );
    }

    // For simple types like string and number
    return String(value);
  };

  // Render agent information
  const renderAgentInfo = (item: DataValue) => {
    // First check if message exists
    if (!item.message) {
      return <span className="text-gray-500 text-sm">—</span>;
    }
    
    // Check if we have an agent ID but no agent data
    const hasAgentIdNoData = item.message.agentId && !item.message.agent;
    
    if (item.message.agent) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.message.agent.name}</span>
          {item.message.agent.role && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{item.message.agent.role}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      );
    } else if (hasAgentIdNoData) {
      // We have an agent ID but couldn't find the agent data
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            Unknown agent
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Agent ID: {item.message.agentId}</p>
                <p className="text-sm text-gray-500">Agent details not found</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    } else {
      // No agent info at all
      return (
        <span className="text-gray-500 text-sm">—</span>
      );
    }
  };

  // Render the table header with sort indicators
  const renderSortableHeader = (title: string, sortType: SortOption, oppositeSortType: SortOption) => {
    const isActive = filter.sortBy === sortType || filter.sortBy === oppositeSortType;
    const isAscending = filter.sortBy === sortType;
    
    return (
      <div 
        className="flex items-center gap-1 cursor-pointer" 
        onClick={() => setFilter({...filter, sortBy: filter.sortBy === sortType ? oppositeSortType : sortType})}
      >
        <span>{title}</span>
        {isActive && (
          isAscending ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className={`grid ${batches.length > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-4 py-4`}>
        <div>
          <Select
            value={filter.paramName}
            onValueChange={(value) =>
              setFilter({ ...filter, paramName: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by parameter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All parameters</SelectItem>
              {parameterNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium whitespace-nowrap">Round:</span>
            <Select
              value={filter.roundId}
              onValueChange={(value) =>
                setFilter({ ...filter, roundId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by round" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rounds</SelectItem>
                {rounds.map((round) => (
                  <SelectItem key={round.id} value={round.id}>
                    {round.name || `${round.type.charAt(0).toUpperCase() + round.type.slice(1)} (${round.sequence})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {batches.length > 0 && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">Batch:</span>
              <Select
                value={filter.batchId}
                onValueChange={(value) =>
                  setFilter({ ...filter, batchId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium whitespace-nowrap">Sort by:</span>
            <Select
              value={filter.sortBy}
              onValueChange={(value) =>
                setFilter({ ...filter, sortBy: value as SortOption })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Newest first</SelectItem>
                <SelectItem value="date-oldest">Oldest first</SelectItem>
                <SelectItem value="parameter-asc">Parameter (A-Z)</SelectItem>
                <SelectItem value="parameter-desc">Parameter (Z-A)</SelectItem>
                <SelectItem value="agent">Agent name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Data Table - Wrapped in flex-1 container for proper scroll behavior */}
      <div className="h-[calc(100vh-260px)] border rounded-md overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            {error}
          </div>
        ) : filteredValues.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            {dataValues.length === 0
              ? "No data values found"
              : "No results match your filters"}
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white border-b">
                <TableRow>
                  <TableHead className="bg-gray-50">
                    {renderSortableHeader("Parameter", "parameter-asc", "parameter-desc")}
                  </TableHead>
                  <TableHead className="bg-gray-50">Value</TableHead>
                  <TableHead className="bg-gray-50">Round</TableHead>
                  {batches.length > 0 && (
                    <TableHead className="bg-gray-50">Batch</TableHead>
                  )}
                  <TableHead className="bg-gray-50">
                    {renderSortableHeader("Created At", "date-oldest", "date-newest")}
                  </TableHead>
                  <TableHead className="bg-gray-50">
                    {renderSortableHeader("Agent", "agent", "agent")}
                  </TableHead>
                  <TableHead className="bg-gray-50">Message Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredValues.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{formatValue(item.value, item.dataType)}</TableCell>
                    <TableCell>
                      {item.roundId ? getRoundName(item.roundId, rounds, { useShortFallback: true, includeSequence: true }) : "—"}
                    </TableCell>
                    {batches.length > 0 && (
                      <TableCell>
                        {item.batchId ? getBatchName(item.batchId) : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {renderAgentInfo(item)}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {item.message?.content ? (
                        <div className="flex flex-col">
                          <span title={String(item.message.content)}>
                            {typeof item.message.content === 'string' 
                              ? item.message.content.substring(0, 100) + (item.message.content.length > 100 ? '...' : '')
                              : JSON.stringify(item.message.content).substring(0, 100) + '...'}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full mt-4">
        <div className="text-sm text-gray-500">
          {filteredValues.length} of {dataValues.length} values
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={exportJSON}
          >
            Export JSON
          </Button>
        </div>
      </div>
    </div>
  );
} 