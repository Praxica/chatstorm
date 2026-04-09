import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { generateTranscriptData, formatTranscript } from '@/lib/utils/transcript'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    const { configId, chatId } = await params
    const userId = await getAuthenticatedUserId()
    const url = new URL(req.url)
    const format = url.searchParams.get('format') || 'text'
    const forceDownload = url.searchParams.get('download') === 'true'

    if (!['text', 'json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be text, json, or csv' },
        { status: 400 }
      )
    }

    const result = await generateTranscriptData(chatId, configId, userId)
    if (!result) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    const { content, contentType, filename } = formatTranscript(
      result.messages,
      result.chat,
      format,
      forceDownload
    )

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }

    if (forceDownload) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
    }

    return new NextResponse(content, {
      status: 200,
      headers
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error generating transcript:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to generate transcript', details: errorMessage },
      { status: 500 }
    )
  }
}
