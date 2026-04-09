import { NextRequest, NextResponse } from 'next/server';
import { BatchService } from '@/lib/services/BatchService';
import { getAuthenticatedUserId, handleAuthError, validateUserAccess } from '@/lib/utils/auth';

// Create a new instance of the batch service
const batchService = new BatchService();

/**
 * GET /api/batches/[batchId]/chats
 * Get chats for a batch
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const { batchId } = params;

  try {
    await getAuthenticatedUserId();

    // Get the batch with chats
    const batch = await batchService.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check if the user has permission to access this batch
    await validateUserAccess(batch.userId);

    return NextResponse.json(batch.batchChats);
  } catch (error) {
    if (error instanceof Error) {
      return handleAuthError(error);
    }
    console.error('Error fetching batch chats:', error);
    return NextResponse.json({ error: 'Failed to fetch batch chats' }, { status: 500 });
  }
} 