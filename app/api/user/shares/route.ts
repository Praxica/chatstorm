import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';

/**
 * GET /api/user/shares
 * List all shares created by the current user
 */
export async function GET(_req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const shares = await prisma.share.findMany({
      where: {
        createdById: userId,
      },
      include: {
        chat: {
          select: {
            title: true,
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ shares });
  } catch (error) {
    console.error('Error fetching user shares:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch shares' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/shares
 * Delete all shares by this user (bulk operation)
 */
export async function DELETE(_req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    // Deactivate all shares by this user
    const result = await prisma.share.updateMany({
      where: {
        createdById: userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('Error deleting user shares:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to delete shares' },
      { status: 500 }
    );
  }
} 