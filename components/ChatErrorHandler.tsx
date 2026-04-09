'use client';

import React from 'react';
import { Button } from './ui/button';
import { Repeat } from 'lucide-react';
import { isOverloadedError } from '@/lib/utils/user-models';

interface ChatErrorHandlerProps {
  error: Error | string | null;
  onRetry: () => void;
  onErrorHandled?: () => void;
}

// Component for handling overloaded errors with model fallback options
interface OverloadedErrorProps {
  error: Error | string;
  onRetry: () => void;
}

const OverloadedError: React.FC<OverloadedErrorProps> = ({ error, onRetry }) => {
  // Try to extract provider from error context or use generic message
  const getProviderName = (): string => {
    // Common provider indicators in model names or error messages
    const errorText = typeof error === 'string' ? error : error?.message || '';
    
    if (errorText.toLowerCase().includes('claude') || errorText.toLowerCase().includes('anthropic')) {
      return 'Anthropic';
    }
    if (errorText.toLowerCase().includes('openai') || errorText.toLowerCase().includes('gpt')) {
      return 'OpenAI';
    }
    if (errorText.toLowerCase().includes('google') || errorText.toLowerCase().includes('gemini')) {
      return 'Google';
    }
    
    return 'AI'; // Generic fallback
  };

  const providerName = getProviderName();

  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="font-medium text-red-800">Service Temporarily Overloaded</span>
      </div>
      
      <p className="text-sm text-red-600 mb-4">
        The {providerName} AI service is currently experiencing high demand. Please try again in a few moments.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        {/* Retry with same model */}
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Repeat className="w-4 h-4" />
          Retry
        </Button>
      </div>
    </div>
  );
};

// Generic error display component
const GenericError: React.FC<{ error: Error | string; onRetry: () => void }> = ({ error, onRetry }) => {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="font-medium text-red-800">Error</span>
      </div>
      <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  );
};

// Main error handler component
export const ChatErrorHandler: React.FC<ChatErrorHandlerProps> = ({
  error,
  onRetry,
  onErrorHandled: _onErrorHandled
}) => {

  if (!error) return null;

  return (
    <div className="mx-4 mb-4">
      {isOverloadedError(error) ? (
        <OverloadedError 
          error={error} 
          onRetry={onRetry}
        />
      ) : (
        <GenericError error={error} onRetry={onRetry} />
      )}
    </div>
  );
};

export default ChatErrorHandler;