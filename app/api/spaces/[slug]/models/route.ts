import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { getAllAvailableModels } from '@/lib/services/ModelService';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/utils/error';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = params;

    // Get the space and verify permissions
    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: { members: true }
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Check if user has access to this space
    const isOwner = space.ownerId === userId;
    const isMember = space.members.some(m => m.userId === userId && m.status === 'active');

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all available models including space-specific custom models
    // Pass a dummy userId since we only care about space models in this context
    const models = await getAllAvailableModels('', space.id);
    
    return NextResponse.json(models);
  } catch (error) {
    logError('GET /api/spaces/[slug]/models', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}