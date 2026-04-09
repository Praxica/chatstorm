import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const sortRoundsSchema = z.object({
  roundIds: z.array(z.string())
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    const body = await request.json()
    const { roundIds } = sortRoundsSchema.parse(body)

    // Update all rounds in a single transaction
    await prisma.$transaction(
      roundIds.map((id, index) => 
        prisma.chatRound.update({
          where: {
            id,
            configId
          },
          data: {
            sequence: index
          }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sorting rounds:', error)
    return NextResponse.json(
      { error: 'Failed to sort rounds' },
      { status: 500 }
    )
  }
} 