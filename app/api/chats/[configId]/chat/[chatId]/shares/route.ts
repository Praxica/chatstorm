import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';

/**
 * GET /api/chats/[configId]/chat/[chatId]/shares
 * Get all shares for a specific chat
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  console.log('Shares API called with URL:', req.url);
  
  try {
    // Step 1: Get internal user ID using the utility function
    console.log('Getting authenticated user ID...');
    const userId = await getAuthenticatedUserId();
    console.log('Internal User ID:', userId);
    
    // Step 2: Extract and validate params
    console.log('Awaiting params...');
    const rawParams = await params;
    console.log('Raw params:', rawParams);
    
    const { configId, chatId } = rawParams;
    console.log('Extracted configId:', configId);
    console.log('Extracted chatId:', chatId);
    
    if (!configId || !chatId) {
      console.log('Missing required parameters');
      const errorResponse = { error: 'Missing required parameters', shares: [] };
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Step 3: Verify chat exists and belongs to user
    try {
      console.log('Querying for chat...');
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          configId: configId,
          userId: userId,
        },
      });
      
      console.log('Chat query result:', chat ? 'found' : 'not found');
      
      if (!chat) {
        console.log('Chat not found or access denied');
        const errorResponse = { error: 'Chat not found or access denied', shares: [] };
        return NextResponse.json(errorResponse, { status: 404 });
      }

      // Step 4: Get shares for this chat
      console.log('Querying for shares...');
      const shares = await prisma.share.findMany({
        where: {
          chatId: chatId,
          createdById: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      console.log('Shares query result count:', shares?.length || 0);
      console.log('First share (if any):', shares && shares.length > 0 ? `ID: ${shares[0].id}` : 'none');

      // Step 5: Return successful response
      const response = { shares: shares || [] };
      console.log('Sending response:', JSON.stringify(response).substring(0, 200) + '...');
      return NextResponse.json(response);
    } 
    catch (dbError) {
      // Handle database errors
      console.log('Database error occurred');
      console.error('Database error details:', dbError);
      
      const errorResponse = { 
        error: 'Database error while fetching shares', 
        shares: [] 
      };
      
      return NextResponse.json(errorResponse, { status: 500 });
    }
  } 
  catch (error) {
    // Handle general errors
    console.log('General error occurred');
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    
    const errorResponse = { 
      error: 'Failed to fetch shares', 
      shares: [] 
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 