import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'

// PUT /api/agents/[id] - Update specific agent
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const userId = await getAuthenticatedUserId();
  
  try {
    // Verify agent belongs to user
    const existingAgent = await prisma.chatAgent.findUnique({
      where: { 
        id: agentId,
        userId: userId
      }
    });

    if (!existingAgent) {
      return Response.json(
        { error: 'Agent not found or unauthorized' },
        { status: 404 }
      );
    }

    const data = await req.json();
    const { projectIds, projectIdsToAdd, projectIdsToRemove, ...otherData } = data;
    
    // If projectIds is provided, use it as a complete replacement
    // If projectIdsToAdd/Remove are provided, use them to modify existing relationships
    const projectsUpdate = projectIds ? {
      set: projectIds.map((id: string) => ({ id }))
    } : projectIdsToAdd || projectIdsToRemove ? {
      ...(projectIdsToAdd ? {
        connect: projectIdsToAdd.map((id: string) => ({ id }))
      } : {}),
      ...(projectIdsToRemove ? {
        disconnect: projectIdsToRemove.map((id: string) => ({ id }))
      } : {})
    } : undefined;

    const result = await prisma.chatAgent.update({
      where: { 
        id: agentId,
        userId: userId
      },
      data: {
        ...otherData,
        projects: projectsUpdate
      },
      include: {
        projects: {
          select: {
            id: true
          }
        }
      }
    });

    // Transform the response to match the expected format
    return Response.json({
      ...result,
      projectIds: result.projects.map(p => p.id)
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    return Response.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - Delete specific agent
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const userId = await getAuthenticatedUserId();
  
  try {
    // Verify agent belongs to user
    const existingAgent = await prisma.chatAgent.findUnique({
      where: { 
        id: agentId,
        userId: userId
      }
    });

    if (!existingAgent) {
      return Response.json(
        { error: 'Agent not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.chatAgent.delete({
      where: { 
        id: agentId,
        userId: userId
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return Response.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
} 