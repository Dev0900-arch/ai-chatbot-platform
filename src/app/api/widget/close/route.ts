import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isClosed: true,
        closedAt: new Date()
      }
    })

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Widget close error:', error)
    return NextResponse.json(
      { error: 'Failed to close conversation' },
      { status: 500, headers: corsHeaders }
    )
  }
}
