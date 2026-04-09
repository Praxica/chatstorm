import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { ChatService } from '@/lib/services/ChatService'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    const { configId, chatId } = await params
    const userId = await getAuthenticatedUserId()

    const result = await ChatService.getChatWithNormalizedMessages(configId, chatId, userId)

    if (!result) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching chat:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to fetch chat', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    const {chatId, configId} = await params
    const userId = await getAuthenticatedUserId()
    const data = await req.json()

    const chat = await prisma.chat.update({
      where: {
        id: chatId,
        configId: configId,
        userId: userId
      },
      data: {
        title: data.title,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(chat)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating chat:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to update chat', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    const {chatId, configId} = await params
    const userId = await getAuthenticatedUserId()

    // Use a transaction to handle deletions in the correct order
    await prisma.$transaction([
      // First delete any shares that reference this chat
      prisma.share.deleteMany({
        where: { chatId }
      }),
      // Then delete branches
      prisma.branch.deleteMany({
        where: { chatId }
      }),
      // Then delete messages
      prisma.message.deleteMany({
        where: { chatId }
      }),
      // Finally delete the chat
      prisma.chat.delete({
        where: {
          id: chatId,
          configId: configId,
          userId: userId
        }
      })
    ])

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error deleting chat:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to delete chat', details: errorMessage },
      { status: 500 }
    )
  }
} 