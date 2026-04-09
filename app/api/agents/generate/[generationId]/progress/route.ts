import { NextResponse } from 'next/server'
import { agentGenerationService } from '@/lib/services/AgentGenerationService'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params
  
  if (!generationId) {
    return NextResponse.json(
      { error: 'generationId is required' },
      { status: 400 }
    )
  }
  
  const progress = await agentGenerationService.getProgress(generationId)
  
  if (!progress) {
    return NextResponse.json(
      { error: 'Generation not found' },
      { status: 404 }
    )
  }
  
  return NextResponse.json(progress)
} 