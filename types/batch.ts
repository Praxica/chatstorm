export type BatchMode = 'count' | 'json' | 'csv'

export interface RoundMessage {
  roundMessageId: string
  chatRoundId: string | null
  sequence: number
  type: 'manual' | 'ai'
  content: string
}

export interface BatchPayload {
  configId: string
  name: string
  batchMode: BatchMode
  totalChats?: number // Optional for JSON mode (calculated from variableData length)
  variableData?: Record<string, unknown>[] // Required for JSON mode
  roundMessages: RoundMessage[] // Required for both modes
}