import { NextResponse } from 'next/server'
import archiver from 'archiver'
import { Readable } from 'stream'
import { BatchService } from '@/lib/services/BatchService'
import { getAuthenticatedUserId, validateUserAccess } from '@/lib/utils/auth'
import { generateTranscriptData, formatTranscript } from '@/lib/utils/transcript'

const batchService = new BatchService()

export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params
    const userId = await getAuthenticatedUserId()
    const url = new URL(req.url)
    const format = url.searchParams.get('format') || 'text'

    if (!['text', 'json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be text, json, or csv' },
        { status: 400 }
      )
    }

    const batch = await batchService.getBatch(batchId)
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    await validateUserAccess(batch.userId)

    // Only include completed chats that have a linked chat record
    const completedChats = batch.batchChats.filter(
      bc => bc.status === 'COMPLETED' && bc.chat
    )

    if (completedChats.length === 0) {
      return NextResponse.json(
        { error: 'No completed chats in this batch' },
        { status: 404 }
      )
    }

    // Create a streaming zip archive
    const archive = archiver('zip', { zlib: { level: 5 } })

    // Convert Node stream to web ReadableStream
    const nodeStream = new Readable().wrap(archive)
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err: Error) => controller.error(err))
      }
    })

    // Generate transcripts and append to archive
    for (const batchChat of completedChats) {
      const result = await generateTranscriptData(
        batchChat.chatId,
        batch.configId,
        userId
      )
      if (!result) continue

      const { content, filename } = formatTranscript(
        result.messages,
        result.chat,
        format
      )
      archive.append(content, { name: filename })
    }

    archive.finalize()

    const safeName = (batch.name || 'batch').replace(/[^a-zA-Z0-9]/g, '_')
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}_transcripts.zip"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error generating batch transcripts:', error.message)
    }
    return NextResponse.json(
      { error: 'Failed to generate batch transcripts' },
      { status: 500 }
    )
  }
}
