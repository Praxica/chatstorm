import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateUserAccess, validateReadAccess } from '@/lib/utils/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params

    // Validate UUID format
    if (!configId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return NextResponse.json(
        { error: 'Invalid config ID format' },
        { status: 400 }
      )
    }

    const config = await prisma.config.findUnique({
      where: { id: configId },
      include: {
        rounds: {
          include: {
            participants: {
              select: {
                id: true
              },
              orderBy: { id: 'asc' }
            },
          },
          orderBy: { sequence: 'asc' }
        },
        projects: {
          select: {
            id: true
          }
        }
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    // Just validate the user is authenticated, but don't check ownership
    // This allows other users to access shared configs for chat usage
    await validateReadAccess();

    return NextResponse.json(config)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if it's a Prisma error
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;
    
    // Get the config first to validate user access
    const existingConfig = await prisma.config.findUnique({
      where: { id: configId },
      select: { userId: true }
    });

    if (!existingConfig) {
      return new Response(JSON.stringify({ error: 'Config not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate user access
    await validateUserAccess(existingConfig.userId);
    
    const data = await request.json();
    
    // Build update object with all fields at once
    const updateData: any = {
      lastUpdatedAt: new Date()
    };

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.chatInstructions !== undefined) {
      updateData.chatInstructions = data.chatInstructions;
    }

    if (data.examplePrompts !== undefined) {
      updateData.examplePrompts = data.examplePrompts;
    }

    if (data.retentionSettings !== undefined) {
      updateData.retentionSettings = data.retentionSettings;
    }

    if (data.memorySettings !== undefined) {
      updateData.memorySettings = data.memorySettings;
    }

    if (data.designSettings !== undefined) {
      updateData.designSettings = data.designSettings;
    }

    if (Array.isArray(data.projectIds)) {
      updateData.projects = {
        set: data.projectIds.map((id: string) => ({ id }))
      };
    }

    // Single update operation
    const config = await prisma.config.update({
      where: { id: configId },
      data: updateData,
      include: {
        rounds: true,
        projects: {
          select: {
            id: true
          }
        }
      }
    });

    return new Response(JSON.stringify(config), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.error('Error updating config:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update config',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    console.log(`Starting delete process for config ID: ${configId}`);
    
    // Get the config with all its relationships to understand what we need to delete
    const existingConfig = await prisma.config.findUnique({
      where: { id: configId },
      include: {
        chats: {
          include: {
            shares: true,
            branches: true
          }
        },
        rounds: {
          include: {
            stances: true
          }
        }
      }
    });

    if (!existingConfig) {
      console.log(`Config not found: ${configId}`);
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    console.log(`Found config with ${existingConfig.chats.length} chats and ${existingConfig.rounds.length} rounds`);

    // Validate user access
    await validateUserAccess(existingConfig.userId);
    console.log(`User access validated for config: ${configId}`);

    // Handle deletion with more granular steps
    try {
      // First handle shares which depend on chats
      let shareIds: string[] = [];
      let branchIds: string[] = [];
      
      // Collect all share and branch IDs that need to be deleted
      for (const chat of existingConfig.chats) {
        if (chat.shares.length > 0) {
          shareIds = shareIds.concat(chat.shares.map(share => share.id));
        }
        if (chat.branches.length > 0) {
          branchIds = branchIds.concat(chat.branches.map(branch => branch.id));
        }
      }
      
      console.log(`Found ${shareIds.length} shares and ${branchIds.length} branches to delete`);

      // Use a transaction with more granular control
      await prisma.$transaction(async (tx) => {
        // Delete shares first if they exist
        if (shareIds.length > 0) {
          console.log(`Deleting ${shareIds.length} shares...`);
          await tx.share.deleteMany({
            where: { 
              id: {
                in: shareIds
              }
            }
          });
        }
        
        // Delete branches if they exist
        if (branchIds.length > 0) {
          console.log(`Deleting ${branchIds.length} branches...`);
          // First update any self-referential relationships
          await tx.branch.updateMany({
            where: {
              id: {
                in: branchIds
              }
            },
            data: {
              parentBranchId: null
            }
          });
          
          // Then delete the branches
          await tx.branch.deleteMany({
            where: {
              id: {
                in: branchIds
              }
            }
          });
        }

        // Delete all messages for all chats associated with this config
        if (existingConfig.chats.length > 0) {
          console.log(`Deleting messages for ${existingConfig.chats.length} chats...`);
          await tx.message.deleteMany({
            where: {
              chatId: {
                in: existingConfig.chats.map(chat => chat.id)
              }
            }
          });
        }

        // Delete all chats
        if (existingConfig.chats.length > 0) {
          console.log(`Deleting ${existingConfig.chats.length} chats...`);
          await tx.chat.deleteMany({
            where: { configId }
          });
        }

        // Then delete the config itself which should cascade to rounds and stances
        console.log(`Deleting config: ${configId}`);
        await tx.config.delete({
          where: { id: configId }
        });
        
        console.log(`Config ${configId} successfully deleted`);
      });

      return NextResponse.json({ success: true })
    } catch (txError) {
      console.error(`Transaction error during config deletion:`, txError);
      
      // Add detailed error information to help with debugging
      const errorDetails = txError instanceof Error 
        ? { 
            message: txError.message,
            name: txError.name,
            stack: txError.stack,
          } 
        : 'Unknown transaction error';
      
      return NextResponse.json(
        { 
          error: 'Failed to delete config during transaction', 
          details: errorDetails
        },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      console.log(`Unauthorized error during config deletion`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Error in delete config endpoint:', error);
    
    // Add detailed error information
    const errorDetails = error instanceof Error 
      ? { 
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: (error as any).code // For Prisma errors
        } 
      : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to delete config', 
        details: errorDetails
      },
      { status: 500 }
    )
  }
} 