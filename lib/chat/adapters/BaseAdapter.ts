// lib/adapters/LLMAdapter.ts
import { ChatState, LLMParams } from "../types";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseAdapterOptions {

}

export class BaseAdapter {
  protected collectedDataParts: Array<{ type: string; data: any }> = [];
  protected collectedMetadata: Record<string, any> = {};
  /**
   * Execute the LLM operation (streaming or non-streaming)
   */
  execute(_chatState: ChatState, _params: LLMParams): any {
  }

  setDataStream(_dataStream: any): void {
  }
  
  handleCompletion(_result: any, _options: BaseAdapterOptions): any {
  }

  writeMessageAnnotation(_annotation: any): void {
  }

  writeData(_data: any): void {
  }

  write(payload: any): void {
    try {
      if (payload && typeof payload.type === 'string') {
        if (payload.type.startsWith('data-')) {
          this.collectedDataParts.push({ type: payload.type, data: payload.data });
          try {
            console.log('[Adapter] Collected data part', { type: payload.type });
          } catch {}
        }
        if (payload.type === 'message-metadata' && payload.metadata && typeof payload.metadata === 'object') {
          this.collectedMetadata = { ...this.collectedMetadata, ...payload.metadata };
          try {
            console.log('[Adapter] Merged message metadata', Object.keys(payload.metadata || {}));
          } catch {}
        }
      }
    } catch {}
  }

  getCollectedDataParts(): Array<{ type: string; data: any }> {
    return this.collectedDataParts.slice();
  }

  getCollectedMetadata(): Record<string, any> {
    return { ...this.collectedMetadata };
  }

  resetCollected(): void {
    this.collectedDataParts = [];
    this.collectedMetadata = {};
  }
}