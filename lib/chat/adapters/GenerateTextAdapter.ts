// lib/adapters/GenerateTextAdapter.ts

import { generateText } from 'ai';
import { BaseAdapter, BaseAdapterOptions } from './BaseAdapter';
import { ChatState, LLMParams } from '../types';
import { logError } from '@/lib/utils/error';

export class GenerateTextAdapter extends BaseAdapter {
  private dataStream: any;
  
  constructor(dataStream: any = null) {
    super();
    this.dataStream = dataStream;
  }
  
  async execute(_chatState: ChatState, params: LLMParams): Promise<any> {
    return await this.executeWithRetry(_chatState, params, 2);
  }
  
  private async executeWithRetry(_chatState: ChatState, params: LLMParams, maxRetries: number = 2, delay: number = 1000): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Build generateText parameters (excluding streaming-specific options)
        const generateParams: any = {
          model: params.model,
          system: params.system,
          messages: params.messages,
          temperature: params.temperature,
        };
        
        // Add tools if provided
        if (params.tools) {
          generateParams.tools = params.tools;
        }
        
        // Note: experimental_transform is streaming-specific and not used with generateText

        const chatId = _chatState.chat?.id ?? 'unknown';
        const agentName = _chatState.activeAgent?.name ?? 'unknown';
        console.log(`[GenerateTextAdapter] Calling generateText for chat:${chatId} agent:"${agentName}" (attempt ${attempt + 1}/${maxRetries})`);

        const response = await generateText(generateParams);

        console.log(`[GenerateTextAdapter] generateText returned for chat:${chatId} agent:"${agentName}" finishReason:${response?.finishReason} textLength:${response?.text?.length ?? 0}`);

        // Call the onFinish handler manually after generateText completes
        if (params.onFinish) {
          params.onFinish(response);
        }

        return response;
      } catch (error: any) {
        lastError = error;
        
        // Check if this is an overloaded error that we should retry
        const isOverloadedError = error?.message === 'Overloaded' || 
                                  error?.type === 'overloaded_error' ||
                                  (error?.message && error.message.toLowerCase().includes('overload'));
        
        if (isOverloadedError && attempt < maxRetries - 1) {
          console.log(`[GenerateTextAdapter] Overloaded error on attempt ${attempt + 1}/${maxRetries}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        
        // Log error and re-throw
        logError('GenerateTextAdapter execute', error);
        
        // If it's not an overloaded error, or we've exhausted retries, throw the error
        throw error;
      }
    }
    
    throw lastError;
  }
  
  handleCompletion(_result: any, _options: BaseAdapterOptions): any { 
    // Not used in batch mode - completion handled in execute()
    return null;
  }
  
  writeMessageAnnotation(annotation: any): void {
    if (this.dataStream) {
      this.dataStream.write({
        'type': 'message-annotations',
        'value': [annotation]
      });
    }
  }

  writeData(data: any): void {
    if (this.dataStream) {
      try {
        this.dataStream.write({
          'type': 'data',
          'value': [data]
        });
      } catch (error) {
        console.error('GenerateTextAdapter, writeData() error', error);
      }
    }
  }

  write(payload: any): void {
    // First record data-* parts/metadata in BaseAdapter for later persistence
    try { super.write(payload); } catch {}
    
    // Then write to dataStream if available (for batch mode this might be null)
    if (this.dataStream) {
      try {
        this.dataStream.write(payload);
      } catch (error) {
        console.error('GenerateTextAdapter, write() error', error);
      }
    }
  }
}