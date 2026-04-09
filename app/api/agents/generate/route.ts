import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { agentGenerationService } from '@/lib/services/AgentGenerationService'

export async function POST(req: Request) {
  try {
    const { count, prompt, creativity, depth, projectIds } = await req.json()

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (count < 1 || count > 10) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 10' },
        { status: 400 }
      )
    }

    const userId = await getAuthenticatedUserId()

    // Use the service to generate agents
    const generationId = await agentGenerationService.generateAgents({
      userId,
      prompt,
      count,
      lengthType: 'FIXED',
      creativity,
      depth,
      projectIds: projectIds || []
    })

    // Return immediately with generation ID for progress tracking
    return NextResponse.json({ generationId })
    
  } catch (error) {
    console.error('Error in agent generation:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to start agent generation', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

 