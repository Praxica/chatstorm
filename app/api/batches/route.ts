import { NextRequest, NextResponse } from 'next/server';
import { BatchService, CreateBatchParams } from '@/lib/services/BatchService';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { BatchPayload } from '@/types/batch';

// Create a new instance of the batch service
const batchService = new BatchService();

/**
 * GET /api/batches
 * List batches for a config
 */
export async function GET(req: NextRequest) {
  try {
    await getAuthenticatedUserId(); // Ensure user is authenticated
    
    const url = new URL(req.url);
    const configId = url.searchParams.get('configId');

    if (!configId) {
      return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
    }

    const batches = await batchService.getBatchesByConfig(configId);
    return NextResponse.json(batches);
  } catch (error) {
    // Check specifically for UnauthorizedError first
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
    }
    
    // Handle other errors safely
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching batches:', errorMessage);
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

/**
 * POST /api/batches
 * Create a new batch
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    
    const body: BatchPayload = await req.json();
    const { 
      configId, 
      name, 
      batchMode,
      totalChats,
      variableData,
      roundMessages
    } = body;

    if (!configId || !name || !batchMode || !roundMessages) {
      return NextResponse.json(
        { error: 'Config ID, name, batchMode, and roundMessages are required' },
        { status: 400 }
      );
    }

    // Validate roundMessages array
    if (!Array.isArray(roundMessages) || roundMessages.length === 0) {
      return NextResponse.json(
        { error: 'roundMessages must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate based on batch mode
    if (batchMode === 'count') {
      if (!totalChats || totalChats <= 0) {
        return NextResponse.json(
          { error: 'totalChats is required and must be > 0 for count mode' },
          { status: 400 }
        );
      }
    } else if (batchMode === 'json' || batchMode === 'csv') {
      if (!variableData || !Array.isArray(variableData) || variableData.length === 0) {
        return NextResponse.json(
          { error: 'variableData array is required for json/csv mode' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'batchMode must be either count, json, or csv' },
        { status: 400 }
      );
    }

    // Calculate totalChats based on mode
    const calculatedTotalChats = (batchMode === 'json' || batchMode === 'csv')
      ? variableData?.length || 0
      : totalChats || 0; // Ensure it's never undefined

    const batchParams: CreateBatchParams = {
      configId,
      userId,
      name,
      totalChats: calculatedTotalChats,
      batchMode,
      variableData,
      roundMessages,
    };
    
    try {
      const batch = await batchService.createBatch(batchParams);
      return NextResponse.json(batch);
    } catch (dbError) {
      // Log database error separately
      const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      console.error('Database error creating batch:', dbErrorMessage);
      
      if (dbErrorMessage.includes('aiPrompt') && dbErrorMessage.includes('not found in')) {
        return NextResponse.json({ 
          error: 'This feature requires a database update. The aiPrompt field is missing.' 
        }, { status: 500 });
      }
      
      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    // Check specifically for UnauthorizedError first
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
    }
    
    // Handle other errors safely
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating batch:', errorMessage);
    
    // For debugging, also log the error type
    if (error !== null && typeof error === 'object') {
      try {
        console.error('Error type:', Object.prototype.toString.call(error));
      } catch {
        // Ignore errors in error logging
      }
    }
    
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
  }
} 