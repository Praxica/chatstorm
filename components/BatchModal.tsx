import { useState, useEffect } from 'react'
import React from 'react'
import { format, subDays } from 'date-fns'
import { Play, Loader2, X, Search, MoreHorizontal, Trash, Trash2, Edit, Database, Eye, Plus, RefreshCw, Download } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { RoundDataExport } from "@/components/rounds/RoundDataExport";
import { BatchPayload, RoundMessage } from "@/types/batch";

type Batch = {
  id: string
  name: string
  totalChats: number
  completedChats: number
  status: string
  createdAt: string
}

type BatchDetailItem = {
  id: string
  chatId: string
  status: string
  createdAt: string
  name?: string
}

type ConfigRound = {
  id: string
  type: string
  transition: 'user' | 'auto'
  sequence: number
  name?: string
  title?: string
}


type BatchDetail = {
  id: string
  name: string
  totalChats: number
  completedChats: number
  status: string
  createdAt: string
  batchChats: BatchDetailItem[]
}

// Update the BatchActionsMenu component
function BatchActionsMenu({
  batch,
  onViewBatch,
  onRename,
  onViewExtractedData,
  onDownloadTranscripts,
  onRerun,
  onDelete,
  hideViewChats = false
}: {
  batch: Batch,
  onViewBatch: (batch: Batch) => void,
  onRename: (batch: Batch, e: React.MouseEvent) => void,
  onViewExtractedData: (batch: Batch, e: React.MouseEvent) => void,
  onDownloadTranscripts: (batch: Batch, e: React.MouseEvent) => void,
  onRerun: (batch: Batch, e: React.MouseEvent) => void,
  onDelete: (batch: Batch, e: React.MouseEvent) => void,
  hideViewChats?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!hideViewChats && (
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            onViewBatch(batch);
          }}>
            <Eye className="mr-2 h-4 w-4" />
            View Chats
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={(e) => onRename(batch, e)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Rename Batch
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => onViewExtractedData(batch, e)}
        >
          <Database className="mr-2 h-4 w-4" />
          View Extracted Data
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => onDownloadTranscripts(batch, e)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Transcripts
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => onRerun(batch, e)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Rerun Batch
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-red-600"
          onClick={(e) => onDelete(batch, e)}
        >
          <Trash className="mr-2 h-4 w-4" />
          Delete Batch
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BatchModal({ 
  configId, 
  isOpen, 
  onClose,
  onViewExtractedData 
}: { 
  configId: string, 
  isOpen: boolean, 
  onClose: () => void,
  onViewExtractedData?: (batchId: string) => void
}) {
  const [activeTab, setActiveTab] = useState('new')
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null)
  const [batchName, setBatchName] = useState(`${format(new Date(), 'yyyy-MM-dd')} Batch`)
  const [batchCount, setBatchCount] = useState(5)
  const [, setMessageType] = useState('manual')
  
  // New JSON-based batch states
  const [batchMode, setBatchMode] = useState<'count' | 'json' | 'csv'>('count')
  const [jsonData, setJsonData] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [parsedJson, setParsedJson] = useState<any[]>([])
  const [availableVariables, setAvailableVariables] = useState<string[]>([])
  const [csvData, setCsvData] = useState('')
  const [csvError, setCsvError] = useState('')
  const [rounds, setRounds] = useState<Array<{id: string, sequence: number, type: 'manual' | 'ai', content: string}>>([
    {id: '1', sequence: 0, type: 'manual', content: ''}
  ])
  const [configRounds, setConfigRounds] = useState<ConfigRound[]>([])
  const [isLoadingRounds, setIsLoadingRounds] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  
  // New state for rename and delete operations
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameId, setRenameId] = useState('')
  const [newBatchName, setNewBatchName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState('')
  const [deleteBatchName, setDeleteBatchName] = useState('')
  const [deleteChats, setDeleteChats] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadBatchId, setDownloadBatchId] = useState('')
  const [downloadBatchName, setDownloadBatchName] = useState('')
  const [downloadCompletedChats, setDownloadCompletedChats] = useState(0)
  const [downloadFormat, setDownloadFormat] = useState<'text' | 'json' | 'csv'>('text')
  const [isDownloading, setIsDownloading] = useState(false)

  const [viewMode, setViewMode] = useState<'default' | 'data-export'>('default');
  const [selectedBatchForData, setSelectedBatchForData] = useState<Batch | null>(null);

  // CSV parsing function
  const parseCsvToJson = (csvText: string): any[] => {
    const text = csvText.trim()
    if (!text) return []
    
    // Detect separator - check if first line has more tabs than commas
    const firstLineEnd = text.indexOf('\n')
    const firstLine = firstLineEnd > -1 ? text.substring(0, firstLineEnd) : text
    const tabCount = (firstLine.match(/\t/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    const separator = tabCount > commaCount ? '\t' : ','
    
    // Parse headers and filter out empty ones
    const headers = firstLine.split(separator)
      .map(h => h.trim().replace(/^"|"$/g, ''))
      .filter(h => h.length > 0) // Remove empty headers
    if (headers.length === 0) return []
    
    const data = []
    
    // For more robust parsing, especially with tab-separated data from Google Sheets
    if (separator === '\t') {
      // Split the remaining text after the first line
      const remainingText = firstLineEnd > -1 ? text.substring(firstLineEnd + 1) : ''
      if (!remainingText.trim()) return []
      
      // Use a more sophisticated approach for tab-separated data
      // Split by lines, then process each line
      const lines = remainingText.split('\n')
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue
        
        // Split by tabs and handle the case where we might have more or fewer columns
        const values = trimmedLine.split('\t')
        
        // Create a row object
        const row: Record<string, string> = {}
        
        // Map values to headers, handling cases where counts don't match
        headers.forEach((header, index) => {
          row[header] = index < values.length ? values[index].trim() : ''
        })
        
        // Only add the row if it has at least one non-empty value
        const hasData = Object.values(row).some(value => value.length > 0)
        if (hasData) {
          data.push(row)
        }
      }
    } else {
      // Comma-separated parsing (simpler case)
      const lines = text.split('\n')
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''))
        if (values.length === headers.length) {
          const row: Record<string, string> = {}
          headers.forEach((header, index) => {
            row[header] = values[index]
          })
          data.push(row)
        }
      }
    }
    
    return data
  }

  // CSV validation and variable extraction
  const validateAndParseCsv = (csvString: string) => {
    if (!csvString.trim()) {
      setCsvError('')
      setParsedJson([])
      setAvailableVariables([])
      return
    }

    try {
      const parsed = parseCsvToJson(csvString)
      
      
      if (parsed.length === 0) {
        const lines = csvString.trim().split('\n')
        if (lines.length < 2) {
          setCsvError('CSV needs both header row and data rows')
        } else {
          setCsvError('Could not parse data rows - check that columns are properly separated')
        }
        setParsedJson([])
        setAvailableVariables([])
        return
      }

      // Extract variables from headers
      const firstRecord = parsed[0]
      const headers = Object.keys(firstRecord)
      
      if (headers.length === 0) {
        setCsvError('CSV must have at least one column')
        setParsedJson([])
        setAvailableVariables([])
        return
      }

      setCsvError('')
      setParsedJson(parsed)
      setAvailableVariables(headers)
    } catch (error) {
      setCsvError('Invalid CSV format: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setParsedJson([])
      setAvailableVariables([])
    }
  }

  // JSON validation and variable extraction
  const validateAndParseJson = (jsonString: string) => {
    if (!jsonString.trim()) {
      setJsonError('')
      setParsedJson([])
      setAvailableVariables([])
      return
    }

    try {
      const parsed = JSON.parse(jsonString)
      
      if (!Array.isArray(parsed)) {
        setJsonError('JSON must be an array of objects')
        setParsedJson([])
        setAvailableVariables([])
        return
      }

      if (parsed.length === 0) {
        setJsonError('Array cannot be empty')
        setParsedJson([])
        setAvailableVariables([])
        return
      }

      // Check that all items are objects
      const allObjects = parsed.every(item => 
        typeof item === 'object' && item !== null && !Array.isArray(item)
      )
      
      if (!allObjects) {
        setJsonError('All array items must be objects')
        setParsedJson([])
        setAvailableVariables([])
        return
      }

      // Extract common variables (keys that exist in ALL records)
      const firstRecord = parsed[0]
      const commonKeys = Object.keys(firstRecord).filter(key => 
        parsed.every(record => record.hasOwnProperty(key))
      )

      setJsonError('')
      setParsedJson(parsed)
      setAvailableVariables(commonKeys)
    } catch (_error) {
      setJsonError('Invalid JSON format')
      setParsedJson([])
      setAvailableVariables([])
    }
  }

  // Handle JSON input change
  const handleJsonChange = (value: string) => {
    setJsonData(value)
    validateAndParseJson(value)
  }

  // Handle CSV input change
  const handleCsvChange = (value: string) => {
    setCsvData(value)
    validateAndParseCsv(value)
  }

  // Insert variable at cursor position
  const insertVariable = (textareaRef: HTMLTextAreaElement | null, variable: string, setter: (value: string) => void, currentValue: string) => {
    if (!textareaRef) return
    
    const start = textareaRef.selectionStart
    const end = textareaRef.selectionEnd
    const newValue = currentValue.substring(0, start) + `{{${variable}}}` + currentValue.substring(end)
    setter(newValue)
    
    // Set cursor position after the inserted variable
    setTimeout(() => {
      textareaRef.focus()
      textareaRef.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
    }, 0)
  }

  // Fetch config rounds
  const fetchConfigRounds = async () => {
    setIsLoadingRounds(true)
    try {
      const response = await fetch(`/api/configs/${configId}/rounds`)
      if (!response.ok) {
        throw new Error('Failed to fetch config rounds')
      }
      const data = await response.json()
      setConfigRounds(data)
    } catch (error) {
      console.error('Error fetching config rounds:', error)
      setConfigRounds([])
    } finally {
      setIsLoadingRounds(false)
    }
  }

  // Check if a round auto-starts based on previous round's transition
  const isRoundAutoStart = (sequence: number): boolean => {
    if (sequence <= 0) return false // First round never auto-starts
    
    // Find the previous round
    const prevRound = configRounds.find(r => r.sequence === sequence - 1)
    
    // If previous round has auto transition, this round auto-starts
    return prevRound?.transition === 'auto'
  }

  // Get round display label for dropdown
  const getRoundLabel = (naturalIndex: number): string => {
    const configRound = configRounds[naturalIndex]
    
    if (configRound) {
      // Use name first, then title, then fall back to type
      const displayName = configRound.name || configRound.title || configRound.type
      const autoStartSuffix = isRoundAutoStart(configRound.sequence) ? ' (auto start)' : ''
      return `${naturalIndex + 1} - ${displayName}${autoStartSuffix}`
    }
    return `${naturalIndex + 1} - Round ${naturalIndex + 1}`
  }


  // Check if all available rounds are used
  const areAllRoundsUsed = (): boolean => {
    
    if (configRounds.length > 0) {
      // Get available rounds (excluding auto-start rounds)
      const availableRounds = configRounds.filter(r => !isRoundAutoStart(r.sequence))
      
      // Check if all available rounds are used
      return rounds.length >= availableRounds.length
    }

    return true;
  }

  // Get next available sequence
  const getNextSequence = (): number => {
    const usedSequences = rounds.map(r => r.sequence)
    
    // If we have config rounds, use natural order (0, 1, 2, 3...)
    if (configRounds.length > 0) {
      const availableSequences = configRounds
        .map((configRound, index) => ({ configRound, index }))
        .filter(({ configRound }) => !isRoundAutoStart(configRound.sequence)) // Exclude auto-start rounds
        .map(({ index }) => index)
        .filter(seq => !usedSequences.includes(seq))
      
      if (availableSequences.length > 0) {
        return Math.min(...availableSequences)
      }
    }
    
    // Fallback to sequential numbering
    for (let i = 1; i <= 20; i++) {
      if (!usedSequences.includes(i)) {
        return i
      }
    }
    return Math.max(...usedSequences) + 1
  }

  // Manage rounds
  const addRound = () => {
    const newRound = {
      id: Date.now().toString(),
      sequence: getNextSequence(),
      type: 'manual' as const,
      content: ''
    }
    setRounds(prev => [...prev, newRound])
  }

  const removeRound = (id: string) => {
    if (rounds.length <= 1) return // Keep at least one round
    setRounds(prev => prev.filter(r => r.id !== id))
  }

  const updateRound = (id: string, field: 'type' | 'content' | 'sequence', value: string | number) => {
    setRounds(prev => prev.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ))
  }

  // Load batches when the modal opens or when we switch to the "all" tab
  useEffect(() => {
    if (isOpen && activeTab === 'all') {
      fetchBatches()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, configId])

  // Load config rounds when the modal opens
  useEffect(() => {
    if (isOpen && configId) {
      fetchConfigRounds()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, configId])

  // Poll for updates if we're viewing a batch
  useEffect(() => {
    if (selectedBatch && isPolling) {
      const interval = setInterval(() => {
        fetchBatchDetails(selectedBatch.id)
      }, 5000) // Poll every 5 seconds
      
      return () => clearInterval(interval)
    }
  }, [selectedBatch, isPolling])

  // Fetch the list of batches for this config
  const fetchBatches = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/batches?configId=${configId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch batches')
      }
      
      const data = await response.json()
      setBatches(data)
    } catch (error) {
      console.error('Error fetching batches:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch details for a specific batch
  const fetchBatchDetails = async (batchId: string) => {
    try {
      const response = await fetch(`/api/batches/${batchId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch batch details')
      }
      
      const data = await response.json()
      setSelectedBatch(data)
      
      // If batch is completed or cancelled, stop polling
      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        setIsPolling(false)
      }
    } catch (error) {
      console.error('Error fetching batch details:', error)
    }
  }

  // Create a new batch
  const createBatch = async () => {
    setIsSubmitting(true)
    try {
      // Transform rounds to the database format
      const roundMessages: RoundMessage[] = rounds.map(round => {
        // Find the corresponding config round
        const configRound = configRounds.find(cr => cr.sequence === round.sequence)
        
        return {
          roundMessageId: round.id,
          chatRoundId: configRound?.id || null,
          sequence: round.sequence,
          type: round.type,
          content: round.content
        }
      })

      // Prepare the request payload
      const payload: BatchPayload = {
        configId,
        name: batchName,
        batchMode,
        roundMessages
      }

      if (batchMode === 'count') {
        // Count mode: set totalChats directly
        payload.totalChats = batchCount
      } else {
        // JSON and CSV modes: include variableData, totalChats calculated from array length
        payload.variableData = parsedJson
      }

      console.log('📤 Sending batch payload:', payload)

      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        throw new Error('Failed to create batch')
      }
      
      const data = await response.json()
      
      // View the newly created batch
      setSelectedBatch(data)
      setActiveTab('all')
      setIsPolling(true)
      
      // Reset form
      setBatchName(`${format(new Date(), 'yyyy-MM-dd')} Batch`)
      setBatchCount(5)
      setMessageType('manual')
      setBatchMode('count')
      setJsonData('')
      setJsonError('')
      setCsvData('')
      setCsvError('')
      setParsedJson([])
      setAvailableVariables([])
      setRounds([{id: '1', sequence: 0, type: 'manual', content: ''}])
      
      // Refresh the batches list
      fetchBatches()
    } catch (error) {
      console.error('Error creating batch:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cancel a batch
  const cancelBatch = async () => {
    if (!selectedBatch) return
    
    try {
      console.log('Attempting to cancel batch:', selectedBatch.id);
      
      const response = await fetch(`/api/batches/${selectedBatch.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'cancel' })
      })
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', response.status, errorText);
        throw new Error(`Failed to cancel batch: ${response.status} ${errorText}`);
      }
      
      // Refresh batch details
      fetchBatchDetails(selectedBatch.id)
    } catch (error) {
      console.error('Error cancelling batch:', error);
      // Show error to user
      alert(`Failed to cancel batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // View a specific batch
  const viewBatch = (batch: Batch) => {
    setSelectedBatch(null) // Clear first to avoid stale data
    fetchBatchDetails(batch.id)
    setIsPolling(batch.status === 'RUNNING' || batch.status === 'PENDING')
  }

  // Back to batch list
  const backToBatchList = () => {
    setSelectedBatch(null)
    setIsPolling(false)
    fetchBatches() // Refresh list
  }
  
  // Open rename modal
  const openRenameModal = (batch: Batch, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the viewBatch
    setRenameId(batch.id)
    setNewBatchName(batch.name)
    setRenameModalOpen(true)
  }
  
  // Open delete dialog
  const openDeleteDialog = (batch: Batch, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the viewBatch
    setDeleteId(batch.id)
    setDeleteBatchName(batch.name)
    setDeleteChats(true)
    setDeleteDialogOpen(true)
  }

  // Open download transcripts modal
  const openDownloadModal = (batch: Batch, e: React.MouseEvent) => {
    e.stopPropagation()
    setDownloadBatchId(batch.id)
    setDownloadBatchName(batch.name)
    setDownloadCompletedChats(batch.completedChats)
    setDownloadFormat('text')
    setDownloadModalOpen(true)
  }

  // Download batch transcripts as zip
  const downloadTranscripts = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch(`/api/batches/${downloadBatchId}/transcripts?format=${downloadFormat}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Download failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${downloadBatchName.replace(/[^a-zA-Z0-9]/g, '_')}_transcripts.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setDownloadModalOpen(false)
    } catch (err) {
      console.error('Failed to download transcripts:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  // View extracted data
  const handleViewExtractedData = (batch: Batch, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the viewBatch
    
    // If parent component provides an external handler, use that
    if (onViewExtractedData) {
      onViewExtractedData(batch.id);
      onClose(); // Close batch modal
    } else {
      // Otherwise, show the data export view embedded in this modal
      setSelectedBatchForData(batch);
      setViewMode('data-export');
    }
  };

  // Rerun batch - copy configuration to new batch form
  const handleRerunBatch = async (batch: Batch, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the viewBatch
    
    try {
      // Ensure config rounds are loaded first
      if (configRounds.length === 0) {
        await fetchConfigRounds();
      }
      
      // Fetch the full batch details to get the configuration
      const response = await fetch(`/api/batches/${batch.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch details');
      }
      
      const batchDetails = await response.json();
      
      // Copy the batch configuration to the form
      setBatchName(`${batch.name} (Copy)`);
      
      // Set batch mode
      if (batchDetails.batchMode) {
        setBatchMode(batchDetails.batchMode);
        
        // If JSON mode, set the variable data
        if (batchDetails.batchMode === 'json' && batchDetails.variableData) {
          const jsonString = JSON.stringify(batchDetails.variableData, null, 2);
          setJsonData(jsonString);
          validateAndParseJson(jsonString);
        } else if (batchDetails.batchMode === 'csv' && batchDetails.variableData) {
          // For CSV mode, convert back to CSV format for display
          const data = batchDetails.variableData;
          if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]).filter(header => header.trim().length > 0);
            // Use tabs for better compatibility with Google Sheets
            const csvString = [
              headers.join('\t'),
              ...data.map(row => headers.map(header => row[header] || '').join('\t'))
            ].join('\n');
            setCsvData(csvString);
            validateAndParseCsv(csvString);
          }
        } else {
          // Count mode
          setBatchCount(batchDetails.totalChats || 5);
        }
      }
      
      // Set round messages if available - wait a bit to ensure config rounds are loaded
      setTimeout(() => {
        if (batchDetails.roundMessages && Array.isArray(batchDetails.roundMessages) && batchDetails.roundMessages.length > 0) {
          const roundMessages = batchDetails.roundMessages.map((rm: any, index: number) => {
            // Find the config round that matches the stored chatRoundId
            const matchingConfigRound = configRounds.find(cr => cr.id === rm.chatRoundId);
            const sequence = matchingConfigRound ? matchingConfigRound.sequence : index;
            
            return {
              id: Date.now().toString() + index, // Generate new IDs
              sequence: sequence, // Use the sequence from the matching config round
              type: rm.type || 'manual',
              content: rm.content || ''
            };
          });
          setRounds(roundMessages);
        } else {
          // If no round messages, set default
          setRounds([{id: Date.now().toString(), sequence: 0, type: 'manual', content: ''}]);
        }
      }, 100);
      
      // Switch to the new batch tab
      setActiveTab('new');
      
      // Clear any selected batch
      setSelectedBatch(null);
      
    } catch (error) {
      console.error('Error copying batch configuration:', error);
      // Show a simple error message
      alert('Failed to copy batch configuration. Please try again.');
    }
  };
  
  // Rename a batch
  const renameBatch = async () => {
    if (!renameId || !newBatchName.trim()) return
    
    setIsRenaming(true)
    try {
      const response = await fetch(`/api/batches/${renameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newBatchName })
      })
      
      if (!response.ok) {
        throw new Error('Failed to rename batch')
      }
      
      // Update the batch name in the list
      setBatches(prev => prev.map(b => 
        b.id === renameId ? {...b, name: newBatchName} : b
      ))
      
      // Update selected batch if it's the one being renamed
      if (selectedBatch && selectedBatch.id === renameId) {
        setSelectedBatch({...selectedBatch, name: newBatchName})
      }
      
      setRenameModalOpen(false)
    } catch (error) {
      console.error('Error renaming batch:', error)
    } finally {
      setIsRenaming(false)
    }
  }
  
  // Delete a batch
  const deleteBatch = async () => {
    if (!deleteId) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/batches/${deleteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deleteChats })
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete batch')
      }
      
      // Remove the deleted batch from the list
      setBatches(prev => prev.filter(b => b.id !== deleteId))
      
      // If the deleted batch is the selected one, go back to the list
      if (selectedBatch && selectedBatch.id === deleteId) {
        setSelectedBatch(null)
      }
      
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error('Error deleting batch:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Back to main batch view from data export
  const handleBackFromDataExport = () => {
    setViewMode('default');
    setSelectedBatchForData(null);
  };

  const getBatchStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pending'
      case 'RUNNING': return 'Running'
      case 'COMPLETED': return 'Completed'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100'
      case 'RUNNING': return 'text-blue-600 bg-blue-100'
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'CANCELLED': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getChatStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pending'
      case 'RUNNING': return 'Running'
      case 'COMPLETED': return 'Completed'
      case 'FAILED': return 'Failed'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const getChatStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100'
      case 'RUNNING': return 'text-blue-600 bg-blue-100'
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'FAILED': return 'text-red-600 bg-red-100'
      case 'CANCELLED': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const renderNewBatchForm = () => {
    const VariableButtons = ({ onInsert, textareaRef: _textareaRef }: { onInsert: (variable: string) => void, textareaRef?: React.RefObject<HTMLTextAreaElement> }) => {
      if (availableVariables.length === 0) return null
      
      return (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-muted-foreground self-center">Variables:</span>
          {availableVariables.map(variable => (
            <Button
              key={variable}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs px-2 py-1 h-6"
              onClick={() => onInsert(variable)}
            >
              {variable}
            </Button>
          ))}
        </div>
      )
    }

    return (
      <>
        <div className="space-y-4 py-2 max-h-[calc(70vh-140px)] overflow-y-auto px-1">
          <div className="space-y-2">
            <span className="text-sm font-semibold block">Batch Name</span>
            <Input
              id="batchName"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Enter batch name"
            />
          </div>
          
          {/* Batch Mode Selection */}
          <div className="space-y-2">
            <span className="text-sm font-semibold block">Batch Source</span>
            <RadioGroup 
              value={batchMode} 
              onValueChange={(value: 'count' | 'json' | 'csv') => setBatchMode(value)}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="count" id="count" />
                <span className="text-sm cursor-pointer" onClick={() => setBatchMode('count')}>Fixed Count</span>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <span className="text-sm cursor-pointer" onClick={() => setBatchMode('json')}>JSON Data</span>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <span className="text-sm cursor-pointer" onClick={() => setBatchMode('csv')}>CSV Data</span>
              </div>
            </RadioGroup>
          </div>

          {batchMode === 'count' ? (
            <div className="space-y-2">
              <span className="text-sm font-semibold block">Number of Chats</span>
              <Input
                id="batchCount"
                type="number"
                min="1"
                max="100"
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value))}
              />
            </div>
          ) : batchMode === 'json' ? (
            <div className="space-y-2">
              <span className="text-sm font-semibold block">JSON Data</span>
              <Textarea
                id="jsonData"
                value={jsonData}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder={`Enter JSON array with variables:\n[\n  {"name": "Alice", "age": 25},\n  {"name": "Bob", "age": 30}\n]`}
                rows={6}
                className={jsonError ? 'border-red-500' : ''}
              />
              {jsonError && (
                <p className="text-sm text-red-600">{jsonError}</p>
              )}
              {parsedJson.length > 0 && (
                <p className="text-sm text-green-600">
                  ✓ Valid JSON - {parsedJson.length} chat{parsedJson.length !== 1 ? 's' : ''} will be created
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-sm font-semibold block">CSV Data</span>
              <Textarea
                id="csvData"
                value={csvData}
                onChange={(e) => handleCsvChange(e.target.value)}
                placeholder={`Paste CSV/TSV data from Excel or Google Sheets:\nname\tage\tcity\nAlice\t25\tNew York\nBob\t30\tSan Francisco`}
                rows={6}
                className={csvError ? 'border-red-500' : ''}
              />
              {csvError && (
                <p className="text-sm text-red-600">{csvError}</p>
              )}
              {parsedJson.length > 0 && (
                <p className="text-sm text-green-600">
                  ✓ Valid CSV - {parsedJson.length} chat{parsedJson.length !== 1 ? 's' : ''} will be created
                </p>
              )}
            </div>
          )}
          
          {/* Rounds Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold block">User Messages</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRound}
                        disabled={areAllRoundsUsed()}
                        className="text-xs px-2 py-1 h-6"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Round
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {areAllRoundsUsed() ? (
                      <p>User messages have been added for all available rounds.</p>
                    ) : (
                      <p>Add a user message for another round</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {rounds.map((round, _index) => {
              return (
                <div key={round.id} className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Round</span>
                        <Select
                          value={round.sequence !== undefined ? round.sequence.toString() : '0'}
                          onValueChange={(value) => updateRound(round.id, 'sequence', parseInt(value))}
                          disabled={isLoadingRounds}
                        >
                          <SelectTrigger className="w-48 h-7 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingRounds ? (
                              <SelectItem value="-1" disabled>Loading rounds...</SelectItem>
                            ) : configRounds.length > 0 ? (
                              configRounds.map((configRound, index) => {
                                const isAlreadyUsed = rounds.some(r => r.sequence === index && r.id !== round.id);
                                const isAutoStartRound = isRoundAutoStart(configRound.sequence);
                                
                                return (
                                  <SelectItem 
                                    key={index} 
                                    value={index.toString()}
                                    disabled={isAlreadyUsed || isAutoStartRound}
                                  >
                                    {getRoundLabel(index)}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              Array.from({length: 10}, (_, i) => i).map(seq => (
                                <SelectItem 
                                  key={seq} 
                                  value={seq.toString()}
                                  disabled={rounds.some(r => r.sequence === seq && r.id !== round.id)}
                                >
                                  {getRoundLabel(seq)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {rounds.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRound(round.id)}
                        className="text-xs px-2 py-1 h-6 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                
                <RadioGroup 
                  value={round.type} 
                  onValueChange={(value: 'manual' | 'ai') => updateRound(round.id, 'type', value)}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id={`manual-${round.id}`} />
                    <span className="text-sm cursor-pointer" onClick={() => updateRound(round.id, 'type', 'manual')}>Manual</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ai" id={`ai-${round.id}`} />
                    <span className="text-sm cursor-pointer" onClick={() => updateRound(round.id, 'type', 'ai')}>Generate with AI</span>
                  </div>
                </RadioGroup>
                
                <div className="space-y-2">
                  <Textarea
                    value={round.content}
                    onChange={(e) => updateRound(round.id, 'content', e.target.value)}
                    placeholder={`Enter ${round.type === 'manual' ? 'message' : 'AI prompt'} for round ${round.sequence + 1}${(batchMode === 'json' || batchMode === 'csv') ? ' (use {{variable}} syntax)' : ''}`}
                    rows={2}
                  />
                  {(batchMode === 'json' || batchMode === 'csv') && (
                    <VariableButtons 
                      onInsert={(variable) => {
                        const textarea = document.querySelector(`textarea[placeholder*="round ${round.sequence + 1}"]`) as HTMLTextAreaElement
                        insertVariable(textarea, variable, (value) => updateRound(round.id, 'content', value), round.content)
                      }}
                    />
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* Footer for buttons */}
        <DialogFooter className="pt-3 sticky bottom-0 bg-white mt-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={createBatch}
            disabled={
              isSubmitting || 
              batchName.trim() === '' || 
              (batchMode === 'count' && batchCount < 1) ||
              (batchMode === 'json' && (parsedJson.length === 0 || !!jsonError)) ||
              (batchMode === 'csv' && (parsedJson.length === 0 || !!csvError)) ||
              rounds.some(round => !round.content.trim())
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                Creating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> 
                Start Batch
              </>
            )}
          </Button>
        </DialogFooter>
      </>
    )
  }

  const renderBatchesList = () => {
    // Filter batches based on selected filters
    const filteredBatches = batches.filter(batch => {
      // Status filter
      const statusMatch = statusFilter === 'all' || batch.status === statusFilter;
      
      // Search filter
      const searchMatch = !searchQuery || 
        batch.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Date filter
      let dateMatch = true;
      const batchDate = new Date(batch.createdAt);
      const today = new Date();
      
      if (dateFilter === 'today') {
        dateMatch = format(batchDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      } else if (dateFilter === 'yesterday') {
        const yesterday = subDays(today, 1);
        dateMatch = format(batchDate, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
      } else if (dateFilter === 'last7days') {
        const last7Days = subDays(today, 7);
        dateMatch = batchDate >= last7Days;
      } else if (dateFilter === 'last30days') {
        const last30Days = subDays(today, 30);
        dateMatch = batchDate >= last30Days;
      }
      
      return statusMatch && searchMatch && dateMatch;
    });
    
    return (
      <div className="space-y-4 py-2">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No batches found</p>
            <Button 
              variant="link" 
              onClick={() => setActiveTab('new')}
              className="mt-2"
            >
              Create a batch
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex items-center w-full">
                {/* Search */}
                <div className="flex-1 pr-2">
                  <div className="relative w-full">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 h-8 w-full text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex-1 pr-2">
                  <div className="flex items-center space-x-1">
                    <label className="text-xs whitespace-nowrap">Status:</label>
                    <select 
                      className="text-xs border rounded p-1 h-8 flex-1 min-w-0"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="PENDING">Pending</option>
                      <option value="RUNNING">Running</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-1">
                    <label className="text-xs whitespace-nowrap">Date:</label>
                    <select 
                      className="text-xs border rounded p-1 h-8 flex-1 min-w-0"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="last7days">Last 7 Days</option>
                      <option value="last30days">Last 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {batches.length} total batches 
                {(statusFilter !== 'all' || searchQuery !== '' || dateFilter !== 'all') && 
                  batches.length !== filteredBatches.length && 
                  `(${filteredBatches.length} filtered)`
                }
              </div>
            </div>
            
            <div className="space-y-0 max-h-72 overflow-y-auto border rounded">
              {filteredBatches.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No batches match the current filters</p>
                </div>
              ) : (
                filteredBatches.map((batch, index) => (
                  <div 
                    key={batch.id} 
                    className={`cursor-pointer hover:bg-gray-50 py-4 px-3 ${index !== 0 ? 'border-t border-gray-200' : ''}`}
                    onClick={() => viewBatch(batch)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center">
                        <h3 className="text-base font-semibold">{batch.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ml-2 ${getBatchStatusColor(batch.status)}`}>
                          {getBatchStatusLabel(batch.status)}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <BatchActionsMenu
                          batch={batch}
                          onViewBatch={viewBatch}
                          onRename={openRenameModal}
                          onViewExtractedData={handleViewExtractedData}
                          onDownloadTranscripts={openDownloadModal}
                          onRerun={handleRerunBatch}
                          onDelete={openDeleteDialog}
                          hideViewChats={true}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <span>{batch.completedChats} of {batch.totalChats} chats completed</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(batch.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  const renderBatchDetail = () => {
    if (!selectedBatch) return null;
    
    // Safely access batchChats using optional chaining
    const chats = selectedBatch.batchChats || []; // Use empty array as fallback
    
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          {(selectedBatch.status === 'RUNNING' || selectedBatch.status === 'PENDING') && (
            <Button 
              variant="destructive" 
              onClick={cancelBatch}
              size="sm"
            >
              <X className="h-4 w-4 mr-1" /> Cancel Batch
            </Button>
          )}
        </div>

        <div className="flex items-center">
          <p className="text-sm text-muted-foreground">
            {format(new Date(selectedBatch.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
          <span className={`text-xs px-2 py-1 rounded-full ml-3 ${getBatchStatusColor(selectedBatch.status)}`}>
            {getBatchStatusLabel(selectedBatch.status)}
          </span>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Progress</span>
                <span>{selectedBatch.completedChats} / {selectedBatch.totalChats} completed</span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full" 
                style={{ 
                  width: `${(selectedBatch.completedChats / selectedBatch.totalChats) * 100}%` 
                }}
              />
            </div>
          </div>
          
          <div className="max-h-72 overflow-y-auto border rounded">
            {chats.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No individual chat records found for this batch yet.</p>
              </div>
            ) : (
              chats.map((chat, index) => {
                // Extract chat number from title if available
                let displayName = chat.name || `Chat #${index + 1}`;
                
                // If the chat has a title and it contains "Chat #N", extract that
                if (chat.name) {
                  const match = chat.name.match(/Chat #(\d+)/);
                  if (match && match[1]) {
                    displayName = `Chat #${match[1]}`;
                  }
                }
                
                return (
                  <div key={chat.id} className={`flex justify-between items-center py-3 px-3 ${index !== 0 ? 'border-t border-gray-200' : ''} text-sm`}>
                    <a 
                      href={`/chats/${configId}/chat/${chat.chatId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline text-blue-600 hover:text-blue-800 truncate max-w-[200px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {displayName}
                    </a>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(chat.createdAt), 'h:mm a')}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getChatStatusColor(chat.status)}`}>
                        {getChatStatusLabel(chat.status)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render data export view
  const renderDataExportView = () => {
    if (!selectedBatchForData) return null;
    
    return (
      <div className="space-y-4 py-2">
        <RoundDataExport
          id="data-export-content"
          configId={configId}
          configTitle={`Batch Data: ${selectedBatchForData.name}`}
          batchId={selectedBatchForData.id}
        />
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
        <DialogContent className={`bg-white ${viewMode === 'data-export' ? 'max-w-4xl' : 'max-w-xl'}`}>
          <DialogHeader>
            {!selectedBatch && viewMode === 'default' ? (
              <>
                <DialogTitle>Run Batches</DialogTitle>
                <DialogDescription>
                  Run multiple chat instances to test your design at scale.
                </DialogDescription>
              </>
            ) : viewMode === 'data-export' ? (
              <DialogTitle>
                <div className="flex items-center">
                  <span 
                    className="cursor-pointer hover:underline font-normal"
                    onClick={handleBackFromDataExport}
                  >
                    Batches
                  </span>
                  <span className="mx-2 text-gray-500">&gt;</span>
                  <span 
                    className="font-semibold cursor-pointer hover:underline"
                    onClick={() => {
                      // View the selected batch's details
                      if (selectedBatchForData) {
                        setViewMode('default');
                        setSelectedBatchForData(null);
                        viewBatch(selectedBatchForData);
                      }
                    }}
                  >
                    {selectedBatchForData?.name}
                  </span>
                  <span className="mx-2 text-gray-500">&gt;</span>
                  <span className="font-semibold">Extracted Data</span>
                </div>
              </DialogTitle>
            ) : (
              <DialogTitle>
                <div className="flex items-center">
                  <span 
                    className="cursor-pointer hover:underline font-normal"
                    onClick={backToBatchList}
                  >
                    Batches
                  </span>
                  <span className="mx-2 text-gray-500">&gt;</span>
                  <span className="font-semibold">{selectedBatch?.name}</span>
                  {selectedBatch && (
                    <div className="ml-2">
                      <BatchActionsMenu
                        batch={selectedBatch}
                        onViewBatch={viewBatch}
                        onRename={openRenameModal}
                        onViewExtractedData={handleViewExtractedData}
                        onDownloadTranscripts={openDownloadModal}
                        onRerun={handleRerunBatch}
                        onDelete={openDeleteDialog}
                        hideViewChats={true}
                      />
                    </div>
                  )}
                </div>
              </DialogTitle>
            )}
          </DialogHeader>
          
          {viewMode === 'data-export' ? (
            renderDataExportView()
          ) : selectedBatch ? (
            renderBatchDetail()
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full flex mb-4 border-b border-gray-200 rounded-none">
                <TabsTrigger 
                  className="flex-1 py-2 text-sm font-medium border-b-2 border-transparent rounded-none transition-colors hover:text-primary/80 hover:bg-gray-50 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent focus:outline-none" 
                  value="new"
                >
                  Run new batch
                </TabsTrigger>
                <TabsTrigger 
                  className="flex-1 py-2 text-sm font-medium border-b-2 border-transparent rounded-none transition-colors hover:text-primary/80 hover:bg-gray-50 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent focus:outline-none" 
                  value="all"
                >
                  All Batches
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="new">
                {renderNewBatchForm()}
              </TabsContent>
              
              <TabsContent value="all">
                {renderBatchesList()}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Rename Batch Modal */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Batch</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              placeholder="Enter new batch name"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRenameModalOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={renameBatch}
              disabled={isRenaming || !newBatchName.trim()}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Renaming...
                </>
              ) : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Download Transcripts Modal */}
      <Dialog open={downloadModalOpen} onOpenChange={(open) => { if (!isDownloading) setDownloadModalOpen(open) }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Download Transcripts</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Download <span className="font-medium text-foreground">{downloadCompletedChats}</span> completed
              chat transcript{downloadCompletedChats !== 1 ? 's' : ''} from &quot;{downloadBatchName}&quot; as a zip file.
            </p>
            <div>
              <p className="text-sm font-medium mb-2">Format</p>
              <RadioGroup
                value={downloadFormat}
                onValueChange={(val) => setDownloadFormat(val as 'text' | 'json' | 'csv')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text" id="fmt-text" />
                  <label htmlFor="fmt-text" className="text-sm cursor-pointer">TXT</label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="fmt-json" />
                  <label htmlFor="fmt-json" className="text-sm cursor-pointer">JSON</label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <label htmlFor="fmt-csv" className="text-sm cursor-pointer">CSV</label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDownloadModalOpen(false)}
              disabled={isDownloading}
            >
              Cancel
            </Button>
            <Button
              onClick={downloadTranscripts}
              disabled={isDownloading || downloadCompletedChats === 0}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteBatchName}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-chats" 
                checked={deleteChats} 
                onCheckedChange={(checked) => setDeleteChats(checked === true)}
              />
              <label 
                htmlFor="delete-chats" 
                className="text-sm cursor-pointer"
              >
                Also delete all associated chats
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                deleteBatch()
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Deleting...
                </>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 