import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AgentService } from '@/lib/services/AgentService';

// GET method to retrieve agents for a template preview
// This endpoint is public and does not require authentication
export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  try {
    // First validate that the template exists and is public
    const template = await prisma.template.findUnique({
      where: {
        id: templateId,
        isPublic: true
      },
      select: {
        configId: true // Need configId to find related agents
      }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found or not public' },
        { status: 404 }
      );
    }

    if (!template.configId) {
      return NextResponse.json(
        { error: 'Template has no configuration to derive agents from' },
        { status: 404 }
      );
    }

    // Use the direct service method to get agents
    const agents = await AgentService.getAgentsFromConfig(template.configId);

    return NextResponse.json(agents);
  } catch (error) {
    console.error('[Preview Agents API] Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
} 