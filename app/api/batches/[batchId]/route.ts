import { NextRequest, NextResponse } from 'next/server';
import { BatchService } from '@/lib/services/BatchService';
import { getAuthenticatedUserId, validateUserAccess } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';

// Create a new instance of the batch service
const batchService = new BatchService();

/**
 * GET /api/batches/[batchId]
 * Get a batch by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  try {
    const _userId = await getAuthenticatedUserId();

    // Get the batch
    const batch = await batchService.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check if the user has permission to access this batch
    await validateUserAccess(batch.userId);

    return NextResponse.json(batch);
  } catch (error) {
    // Handle different error types more carefully
    if (error instanceof Error) {
      if (error.name === 'UnauthorizedError') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      console.error('Error fetching batch:', error.message);
    } else {
      console.error('Unknown error fetching batch:', error);
    }
    
    // Return a safe response
    return NextResponse.json({ error: 'Failed to fetch batch' }, { status: 500 });
  }
}

/**
 * POST /api/batches/[batchId]
 * Cancel a batch
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  
  try {
    // Make request body parsing more robust
    let action = '';
    try {
      if (req.body) {
        const body = await req.json();
        action = body?.action || '';
        console.log('Received cancel request with action:', action);
      } else {
        console.warn('Request body is empty for batch cancellation');
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ 
        error: `Invalid request body: ${parseError instanceof Error ? parseError.message : String(parseError)}` 
      }, { status: 400 });
    }

    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Invalid action. Expected "cancel", got: ' + action }, { status: 400 });
    }

    const _userId = await getAuthenticatedUserId();

    // Get the batch to check ownership
    const batch = await batchService.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check if the user has permission to cancel this batch
    await validateUserAccess(batch.userId);

    // Cancel the batch
    await batchService.cancelBatch(batchId);
    console.log(`Successfully cancelled batch ${batchId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle different error types more carefully
    if (error instanceof Error) {
      if (error.name === 'UnauthorizedError') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      console.error('Error canceling batch:', error.message, error.stack);
    } else {
      console.error('Unknown error canceling batch:', error);
    }
    
    // Return a safe response
    return NextResponse.json({ 
      error: `Failed to cancel batch: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}

/**
 * PATCH /api/batches/[batchId]
 * Update a batch (rename)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const _userId = await getAuthenticatedUserId();

    // Get the batch to check ownership
    const batch = await batchService.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check if the user has permission to update this batch
    await validateUserAccess(batch.userId);

    // Update the batch name
    const updatedBatch = await prisma.chatBatch.update({
      where: { id: batchId },
      data: { name }
    });

    return NextResponse.json(updatedBatch);
  } catch (error) {
    // Handle different error types more carefully
    if (error instanceof Error) {
      if (error.name === 'UnauthorizedError') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      console.error('Error updating batch:', error.message);
    } else {
      console.error('Unknown error updating batch:', error);
    }
    
    // Return a safe response
    return NextResponse.json({ error: 'Failed to update batch' }, { status: 500 });
  }
}

/**
 * DELETE /api/batches/[batchId]
 * Delete a batch
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  
  try {
    // Try to parse the request body, but handle potential errors
    let deleteChats = false;
    try {
      const body = await req.json();
      deleteChats = !!body.deleteChats;
    } catch (_e) {
      // If JSON parsing fails, use the default value
      console.warn('Failed to parse delete request body, using default values');
    }

    const _userId = await getAuthenticatedUserId();

    // Get the batch to check ownership
    const batch = await batchService.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check if the user has permission to delete this batch
    await validateUserAccess(batch.userId);

    // Delete the batch and optionally its chats
    try {
      await prisma.$transaction(async (tx) => {
        // First delete batch chats if requested
        if (deleteChats) {
          console.log(`Deleting batch ${batchId} with associated chats`);
          
          // Get all chat IDs for this batch
          const batchChats = await tx.batchChat.findMany({
            where: { batchId },
            select: { chatId: true }
          });
          
          const chatIds = batchChats.map(bc => bc.chatId);
          console.log(`Found ${chatIds.length} associated chats to delete`);
          
          // First remove the batch associations
          await tx.batchChat.deleteMany({
            where: { batchId }
          });
          console.log(`Deleted batch chat associations`);
          
          if (chatIds.length > 0) {
            // Delete messages in those chats first (to avoid foreign key issues)
            try {
              const deletedMessageCount = await tx.message.deleteMany({
                where: { chatId: { in: chatIds } }
              });
              console.log(`Deleted ${deletedMessageCount.count} messages`);
            } catch (msgErr) {
              console.error(`Error deleting messages: ${msgErr instanceof Error ? msgErr.message : msgErr}`);
              // Continue with the transaction
            }
            
            // Delete branches in those chats
            try {
              const deletedBranchCount = await tx.branch.deleteMany({
                where: { chatId: { in: chatIds } }
              });
              console.log(`Deleted ${deletedBranchCount.count} branches`);
            } catch (branchErr) {
              console.error(`Error deleting branches: ${branchErr instanceof Error ? branchErr.message : branchErr}`);
              // Continue with the transaction
            }
            
            // Then delete the chats themselves
            try {
              const deletedChatCount = await tx.chat.deleteMany({
                where: { id: { in: chatIds } }
              });
              console.log(`Deleted ${deletedChatCount.count} chats`);
            } catch (chatErr) {
              console.error(`Error deleting chats: ${chatErr instanceof Error ? chatErr.message : chatErr}`);
              // Continue with the transaction
            }
          }
        } else {
          console.log(`Deleting batch ${batchId} without deleting associated chats`);
          // Just remove the association between batch and chats
          await tx.batchChat.deleteMany({
            where: { batchId }
          });
        }
        
        // Finally delete the batch
        console.log(`Deleting batch record`);
        await tx.chatBatch.delete({
          where: { id: batchId }
        });
        console.log(`Batch ${batchId} deleted successfully`);
      });
      
      return NextResponse.json({ success: true });
    } catch (txError) {
      console.error('Transaction error:', txError instanceof Error ? txError.message : txError);
      throw new Error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown transaction error'}`);
    }
  } catch (error) {
    // Handle different error types more carefully
    if (error instanceof Error) {
      if (error.name === 'UnauthorizedError') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      console.error('Error deleting batch:', error.message);
    } else {
      console.error('Unknown error deleting batch:', error);
    }
    
    // Return a safe response
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 });
  }
} 