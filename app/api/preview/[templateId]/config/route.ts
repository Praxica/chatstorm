import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET method to retrieve config for a template preview
// This endpoint is public and does not require authentication
export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  console.log('[Preview Config API] GET request for template:', templateId);
  try {
    // First validate that the template exists and is public
    const template = await prisma.template.findUnique({
      where: {
        id: templateId,
        isPublic: true
      },
      select: {
        configId: true
      }
    });

    console.log('[Preview Config API] Template:', template);

    if (!template) {
      console.log('[Preview Config API] Template not found or not public:', templateId);
      return NextResponse.json(
        { error: 'Template not found or not public' },
        { status: 404 }
      );
    }

    console.log('[Preview Config API] Template configId:', template?.configId);

    if (!template.configId) {
      console.log('[Preview Config API] Template has no config ID:', templateId);
      return NextResponse.json(
        { error: 'Template has no configuration' },
        { status: 404 }
      );
    }

    console.log('[Preview Config API] Tring to get config data');

    // Get the config data
    console.log('[Preview Config API] Fetching config data for ID:', template.configId);
    const config = await prisma.config.findUnique({
      where: {
        id: template.configId
      },
      include: {
        rounds: {
          orderBy: { sequence: 'asc' }
        }
      }
    });

    console.log('[Preview Config API] Config data found, rounds length', config?.rounds.length);

    if (!config) {
      console.log('[Preview Config API] Config not found:', template.configId);
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }
    

    console.log('[Preview Config API] Successfully retrieved config:', config.id);
    return NextResponse.json(config);
  } catch (error) {
    console.error('[Preview Config API] Error fetching config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
} 