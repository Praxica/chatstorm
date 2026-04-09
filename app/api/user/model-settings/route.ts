import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { logError } from '@/lib/utils/error'

// Handler for GET requests
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { capabilities: true },
    })

    if (!user || !user.capabilities) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Parse the JSON modelSettings
    const modelSettingsRaw = user.capabilities.modelSettings as any
    let modelSettings = {
      mode: 'all',
      includedModels: [],
      excludedModels: [],
      defaultModel: null
    }
    
    try {
      if (typeof modelSettingsRaw === 'string') {
        const parsed = JSON.parse(modelSettingsRaw)
        modelSettings = {
          mode: parsed.mode || 'all',
          includedModels: parsed.includedModels || [],
          excludedModels: parsed.excludedModels || [],
          defaultModel: parsed.defaultModel || null
        }
      } else if (typeof modelSettingsRaw === 'object') {
        modelSettings = {
          mode: modelSettingsRaw.mode || 'all',
          includedModels: modelSettingsRaw.includedModels || [],
          excludedModels: modelSettingsRaw.excludedModels || [],
          defaultModel: modelSettingsRaw.defaultModel || null
        }
      }
    } catch (e) {
      console.error('Error parsing model settings:', e)
    }

    return NextResponse.json(modelSettings)
  } catch (error) {
    logError('GET /api/user/model-settings', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Handler for POST requests
export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    
    // Validate the data
    if (!data || !data.mode || !['all', 'include', 'exclude'].includes(data.mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    // Ensure arrays are present and valid
    const modelSettings = {
      mode: data.mode,
      includedModels: Array.isArray(data.includedModels) ? data.includedModels : [],
      excludedModels: Array.isArray(data.excludedModels) ? data.excludedModels : [],
      defaultModel: data.defaultModel || null
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { capabilities: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update or create capabilities if needed
    if (user.capabilities) {
      await prisma.userCapabilities.update({
        where: { id: user.capabilities.id },
        data: {
          modelSettings: modelSettings
        }
      })
    } else {
      await prisma.userCapabilities.create({
        data: {
          userId: user.id,
          modelSettings: modelSettings
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('POST /api/user/model-settings', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 