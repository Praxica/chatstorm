// lib/adapters/LLMAdapterFactory.ts
import { BaseAdapter } from './BaseAdapter';
import { StreamingAdapter } from './StreamingAdapter';
import { GenerateTextAdapter } from './GenerateTextAdapter';

export class AdapterFactory {
  /**
   * Get the appropriate LLM adapter based on streaming needs
   */
  static getAdapter(options: { streaming: boolean, dataStream?: any }): BaseAdapter {
    if (options.streaming) {
      return new StreamingAdapter();
    }
    
    return new GenerateTextAdapter(options.dataStream || null);
  }
}