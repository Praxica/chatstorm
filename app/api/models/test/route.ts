import { NextRequest, NextResponse } from 'next/server';
import { generateText, type LanguageModel } from 'ai';
import { createModelProvider } from '@/lib/utils/models';
import { createOpenAI } from '@ai-sdk/openai';
import { logError } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    const { provider, modelId, apiKey, baseURL } = await request.json();

    // Debug: Log the received payload
    console.log('[MODEL_TEST] Received payload:', {
      provider,
      modelId,
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'NONE',
      baseURL,
    });

    if (!provider || !modelId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, modelId, and apiKey are required' },
        { status: 400 }
      );
    }

    let model: LanguageModel;

    // Use shared model creation utilities
    if (provider === 'Custom (OpenAI-compatible)' || provider === 'custom') {
      if (!baseURL) {
        return NextResponse.json(
          { error: 'Base URL is required for custom providers' },
          { status: 400 }
        );
      }
      const customProvider = createOpenAI({
        apiKey,
        baseURL,
        name: 'custom.chat',
      });
      // Use Chat Completions-compatible endpoint for OpenAI-compatible providers
      model = customProvider.chat(modelId) as unknown as LanguageModel;
      // Debug: Log the custom model object
      console.log('[MODEL_TEST] Created custom OpenAI-compatible model:', model);
    } else {
      // Use createModelProvider for standard providers
      model = createModelProvider(provider.toLowerCase(), modelId, { apiKey }) as unknown as LanguageModel;
      // Debug: Log the standard model object
      console.log('[MODEL_TEST] Created standard provider model:', model);
      if (!model) {
        return NextResponse.json(
          { error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
      }
    }

    // Test the connection with a simple message
    let response;
    try {
      response = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Testing the connection to this model. Please respond with "Connection successful" to confirm.'
          }
        ],
        temperature: 0.1,
      });
      // Debug: Log the full response from generateText
      console.log('[MODEL_TEST] generateText response:', response);
    } catch (genError) {
      logError('Error during generateText in /api/models/test', genError);
      throw genError;
    }

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      response: response.text,
    });
  } catch (error: any) {
    logError('Testing custom model connection in /api/models/test', error);
    // Extract meaningful error message
    let errorMessage = 'Unknown error occurred';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.body?.message) {
      errorMessage = error.body.message;
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.statusText) {
      errorMessage = `${error.status}: ${error.statusText}`;
    } else if (error.cause?.message) {
      errorMessage = error.cause.message;
    }
    if (error.status === 401 || error.status === 403) {
      errorMessage = 'Authentication failed. Please check your API key.';
    } else if (error.status === 404) {
      errorMessage = 'Model not found. Please check your model ID.';
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    }
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}