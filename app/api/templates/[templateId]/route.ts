import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  console.log('[Template API] GET request for template:', templateId);
  try {
    const template = await prisma.template.findUnique({
      where: {
        id: templateId,
        isPublic: true
      },
      include: {
        config: true
      }
    });

    if (!template) {
      console.log('[Template API] Template not found or not public:', templateId);
      return NextResponse.json(
        { error: 'Template not found or not public' },
        { status: 404 }
      );
    }

    console.log('[Template API] Successfully retrieved template:', template.id);
    return NextResponse.json(template);
  } catch (error) {
    console.error('[Template API] Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
} 