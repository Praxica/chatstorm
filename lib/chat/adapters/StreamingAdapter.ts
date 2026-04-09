// lib/adapters/StreamingLLMAdapter.ts

import { BaseAdapter, BaseAdapterOptions } from './BaseAdapter';
import { ChatState, LLMParams } from '../types';
import { streamText } from 'ai';
import { logError } from '@/lib/utils/error';

export class StreamingAdapter extends BaseAdapter {
  private dataStream: any;
  
  constructor() {
    super();
  }

  setDataStream(dataStream: any) {
    this.dataStream = dataStream;
  }
  
  
  execute(chatState: ChatState, params: LLMParams): any {
    try {

      const result = streamText({
        ...params,
        providerOptions: {
          xai: {
            reasoning_effort: 'low',
          },
          google: {
            thinkingConfig: {
              includeThoughts: false,
            },
          },
        },
        onStepFinish: (step) => {
          if (step.toolCalls?.length > 0) {
            console.log(`[StreamingAdapter] Step completed: ${step.toolCalls.length} tool calls`);
          }
        },
        onFinish: (completion) => {
          console.log('[StreamingAdapter] onFinish called:', {
            hasText: !!completion?.text,
            textLength: completion?.text?.length || 0,
            hasToolCalls: !!completion?.toolCalls,
            toolCallsCount: completion?.toolCalls?.length || 0,
            staticToolCallsCount: completion?.staticToolCalls?.length || 0,
            dynamicToolCallsCount: completion?.dynamicToolCalls?.length || 0,
            hasUsage: !!completion?.usage,
            hasError: !!(completion as any)?.error,
            errorMessage: (completion as any)?.error?.message,
            finishReason: completion?.finishReason,
            allProperties: Object.keys(completion || {})
          });


          // Log tool calls if present in any of the arrays
          const allToolCalls = [
            ...(completion?.toolCalls || []),
            ...(completion?.staticToolCalls || []),
            ...(completion?.dynamicToolCalls || [])
          ];

          if (allToolCalls.length > 0) {
            console.log(`[StreamingAdapter] ${allToolCalls.length} tool calls completed`);
          }
          
          // Check if this was called after an error - be more deterministic
          // Don't check for text since tool-only responses are valid
          const hasError = (completion as any)?.error || 
                          completion?.finishReason === 'error' ||
                          (!completion?.text && !completion?.toolCalls); // Only error if BOTH are missing
          
          if (hasError) {
            console.log('[StreamingAdapter] onFinish called after error - skipping onFinish callback:', {
              hasError: !!(completion as any)?.error,
              finishReason: completion?.finishReason,
              hasText: !!completion?.text,
              hasToolCalls: !!completion?.toolCalls
            });
            return;
          }
          
          if (params.onFinish) {
            // Transform the response before passing it to onFinish
            params.onFinish(completion);
          }
        },
        onError: ({ error }: { error: any }) => {
          console.log('[StreamingAdapter] onError called - will onFinish still run?');
          logError('streamText onError', error);
          
          // For overloaded errors, suggest retry to user
          if (error?.message === 'Overloaded' || error?.type === 'overloaded_error') {
            console.log('[StreamingAdapter] Overloaded error detected. User should retry in a few moments.');
          }
          
          // Write error to stream and close it to prevent completion logic
          if (this.dataStream) {
            this.dataStream.write({
              type: 'error',
              errorText: error?.message === 'Overloaded' || error?.type === 'overloaded_error' 
                ? 'The AI service is currently overloaded. Please try again in a few moments.'
                : 'An error occurred during streaming. ' + error?.message
            });
            // Don't close the stream here - let the error bubble up naturally
          }
        }
      });

      // Merge the UI message stream (with metadata) into the writer we control
      if (!this.dataStream || typeof this.dataStream.merge !== 'function') {
        throw new Error('Data stream not set in StreamingAdapter');
      }
      const uiStreamAny = (result as any).toUIMessageStream({
        originalMessages: (params as any).messages,
        onError: (error: any) => {
          // Use standardized error logger; avoid double-logging huge objects
          try {
            logError('StreamingAdapter toUIMessageStream onError', error);
          } catch {}
          
          // Provide more specific error messages for known error types
          if (error?.message === 'Overloaded' || error?.type === 'overloaded_error') {
            return 'The AI service is currently overloaded. Please try again in a few moments.';
          }
          
          return 'An error occurred during tool execution or streaming.';
        },
        messageMetadata: ({ part }: any) => {
          if (part?.type === 'start') {
            const baseMetadata = {
              messageId: (chatState as any)?.messageId,  // Pre-generated database UUID for assistant message
              userMessageId: (chatState as any)?.userMessageId, // Database UUID for user message
              createdAt: Date.now(),
              model: ((params as any)?.model?.modelId || (params as any)?.model?.id || 'unknown'),
              agentId: chatState?.activeAgent?.id,
              roundId: chatState?.activeRound?.id,
              sessionId: (chatState as any)?.currentSessionId,
            };

            // Only include prompts in streaming metadata if showMessageMetadata is enabled
            // (they'll still be saved to database regardless)
            const showMessageMetadata = chatState?.config?.designSettings?.showMessageMetadata;
            if (showMessageMetadata) {
              return {
                ...baseMetadata,
                prompts: {
                  system: chatState?.meta?.prompts?.system || '',
                  instructions: chatState?.meta?.prompts?.instructions || ''
                }
              };
            }

            return baseMetadata;
          }
          return undefined;
        },
        finishMetadata: ({ part }: any) => {
          const usage = (part as any)?.totalUsage ?? (part as any)?.usage;
          if (usage) {
            return {
              totalTokens: usage.totalTokens,
              usage: {
                promptTokens: usage.promptTokens || usage.inputTokens,
                completionTokens: usage.completionTokens || usage.outputTokens,
                totalTokens: usage.totalTokens
              }
            };
          }
          return undefined;
        },
      });
      const mergeArg = (uiStreamAny && typeof (uiStreamAny as any).getReader === 'function')
        ? uiStreamAny
        : ((uiStreamAny as any)?.stream ?? uiStreamAny);
      this.dataStream.merge(mergeArg);

    } catch (error) {
      logError('StreamingAdapter execute', error);
      throw error;
    }
  }
  
  handleCompletion(_result: any, _options: BaseAdapterOptions): any {
    // Not used in streaming mode
  }
  
  writeMessageAnnotation(annotation: any): void {
    if (!this.dataStream) {
      console.error('Cannot write message annotation: data stream not set');
      return;
    }
    try {
      this.dataStream.write({
        type: 'data-metadata',
        data: annotation
      });
    } catch (error) {
      console.error('Error writing message annotation:', error);
    }
  }

  writeData(data: any): void {
    if (!this.dataStream) {
      console.error('Cannot write data: data stream not set');
      return;
    }
    try {
      this.dataStream.write({
        type: 'data-generic',
        data
      });
    } catch (error) {
      console.error('StreamingAdapter, writeData() error:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  write(payload: any): void {
    if (!this.dataStream) {
      console.error('Cannot write: data stream not set');
      return;
    }
    try {
      // First record data-* parts/metadata in BaseAdapter for later persistence
      try { super.write(payload); } catch {}
      this.dataStream.write(payload);
    } catch (error) {
      console.error('StreamingAdapter, write() error:', error);
    }
  }
}