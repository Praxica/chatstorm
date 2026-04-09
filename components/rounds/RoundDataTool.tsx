import { type Round, type DataParameter as RoundDataParameter, type DataTool as RoundDataTool } from "@/types/config-round"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Export the interfaces for external use
export type DataParameter = RoundDataParameter;
export type DataTool = RoundDataTool;

export function RoundDataTool({
  round,
  isOpen: _isOpen = true,
  onUpdate,
  onClose,
  onUnsavedChanges,
}: {
  round: Round
  isOpen?: boolean
  onUpdate: (id: string, config: Partial<Round> & { dataTool?: DataTool }) => void
  onClose: () => void
  onUnsavedChanges?: (hasUnsavedChanges: boolean) => void
}) {
  const [dataTool, setDataTool] = useState<DataTool>({
    instructions: round.dataTool?.instructions || '',
    parameters: round.dataTool?.parameters || []
  });

  // Track if there are unsaved changes
  useEffect(() => {
    const hasUnsavedChanges = 
      dataTool.instructions !== (round.dataTool?.instructions || '') ||
      JSON.stringify(dataTool.parameters) !== JSON.stringify(round.dataTool?.parameters || []);
    
    onUnsavedChanges?.(hasUnsavedChanges);
  }, [dataTool, round.dataTool, onUnsavedChanges]);

  const handleAddParameter = () => {
    setDataTool(prev => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { name: '', description: '', type: 'string' }
      ]
    }));
  };

  const handleRemoveParameter = (index: number) => {
    setDataTool(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index)
    }));
  };

  const handleParameterChange = (index: number, field: keyof DataParameter, value: string) => {
    setDataTool(prev => ({
      ...prev,
      parameters: prev.parameters.map((param, i) => {
        if (i === index) {
          return { ...param, [field]: value };
        }
        return param;
      })
    }));
  };

  const handleInstructionsChange = (instructions: string) => {
    setDataTool(prev => ({ ...prev, instructions }));
  };

  const handleSave = () => {
    onUpdate(round.id, {
      dataTool
    });
    onClose();
  };

  const isValidVariableName = (name: string) => {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
  };

  const hasValidParameters = dataTool.parameters.every(param => 
    param.name && isValidVariableName(param.name)
  );

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 w-full max-h-[calc(100vh-200px)] p-6 pl-0">
        <div className="space-y-6 pl-1 pr-1">
          
          {/* Instructions Section */}
          <div className="flex items-center gap-4 p-3 bg-gray-100 rounded-md mb-4">
            <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">i</span>
            </div>
            <p className="text-sm text-black">Define parameters to extract data from LLM messages. You can then export this data into CSV and JSON formats. Great for experiments!</p>
          </div>
          <div>
            <label className="font-semibold mb-2 block">Instructions</label>
            <div className="text-sm text-muted-foreground mb-2">
              For the AI to extract data from each message
            </div>
            <Textarea 
              value={dataTool.instructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              placeholder="E.g., Extract the key insights from your analysis"
              className="min-h-[100px]"
            />
          </div>

          {/* Parameters Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="font-semibold">Parameters</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAddParameter}
                className="bg-gray-50 hover:border-gray-400 inline-flex items-center whitespace-nowrap"
              >
                <div className="inline-flex items-center">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </div>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              Define the data to be extracted
            </div>
            
            {dataTool.parameters.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4 bg-gray-100 rounded-md">
                No parameters defined. Add one to get started.
              </div>
            )}

            {dataTool.parameters.map((param, index) => (
              <div key={index} className="mb-4 p-3 bg-gray-100 rounded-md">
                <div className="flex justify-between mb-4">
                  <span className="text-sm font-semibold">Parameter {index + 1}</span>
                  <Button 
                    className="mt-(-2px) h-4"
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRemoveParameter(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold block mb-1">Name <span className="text-xs font-medium">(variable name, no spaces)</span></label>
                      <Input
                        value={param.name}
                        onChange={(e) => handleParameterChange(index, 'name', e.target.value)}
                        placeholder="E.g., insightCount"
                        className={cn(
                          "bg-white",
                          !isValidVariableName(param.name) && param.name ? 'border-red-500' : ''
                        )}
                      />
                      {!isValidVariableName(param.name) && param.name && (
                        <p className="text-xs text-red-500 mt-1">
                          Must start with a letter and contain only letters, numbers, and underscores
                        </p>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <label className="text-xs font-semibold block mb-1">Type</label>
                      <Select
                        value={param.type}
                        onValueChange={(value) => handleParameterChange(index, 'type', value)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">True/False</SelectItem>
                          <SelectItem value="array_string">Collection of text</SelectItem>
                          <SelectItem value="array_number">Collection of numbers</SelectItem>
                          <SelectItem value="keyvalue">Collection of key-value pairs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold block mb-1">Description <span className="text-xs font-medium">(optional)</span></label>
                    <Input
                      value={param.description}
                      onChange={(e) => handleParameterChange(index, 'description', e.target.value)}
                      placeholder="E.g., Number of key insights identified"
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {/* Add a duplicate "Add" button if there are 2 or more parameters */}
            {dataTool.parameters.length >= 2 && (
              <div className="flex">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddParameter}
                  className="mt-2 bg-gray-50 hover:border-gray-400"
                >
                  <Plus className="h-3 w-3 mr-0" />
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t p-4 flex items-center justify-end gap-2 flex-shrink-0">
        <Button 
          variant="outline" 
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={dataTool.parameters.length > 0 ? !hasValidParameters || !dataTool.instructions : false}
        >
          Save
        </Button>
      </div>
    </div>
  )
} 