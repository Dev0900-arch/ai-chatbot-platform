import { NextRequest, NextResponse } from 'next/server'
import { prisma, getPrismaErrorMessage } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let firebaseUid: string | undefined
  let email: string | undefined
  let name: string | undefined

  try {
    const body = await request.json()
    firebaseUid = body.firebaseUid
    email = body.email
    name = body.name

    if (!firebaseUid || !email) {
      return NextResponse.json(
        { error: 'firebaseUid and email are required' },
        { status: 400 }
      )
    }

    // Use upsert to handle race conditions atomically
    // This prevents "unique constraint failed" errors when multiple
    // requests try to create the same user simultaneously
    const user = await prisma.user.upsert({
      where: { firebaseUid },
      update: {
        // Update email if it changed (e.g., user verified email)
        email,
        // Only update name if provided and user doesn't have one
        ...(name && { name }),
      },
      create: {
        firebaseUid,
        email,
        name: name || email.split('@')[0],
        botName: 'AI Assistant',
        welcomeMessage: 'Hello! How can I help you today?',
        primaryColor: '#3B82F6',
        aiModel: 'openai/gpt-3.5-turbo',
      },
    })

    return NextResponse.json({ user, success: true })
  } catch (error) {
    console.error('User sync error:', error)

    // Check if it's a unique constraint error on email (user exists with different firebaseUid)
    if (error instanceof Error && error.message.includes('Unique constraint') && email && firebaseUid) {
      // Try to find and update existing user by email
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email },
        })

        if (existingUser) {
          const updatedUser = await prisma.user.update({
            where: { email },
            data: { firebaseUid },
          })
          return NextResponse.json({ user: updatedUser, success: true })
        }
      } catch (innerError) {
        console.error('Failed to recover from unique constraint error:', innerError)
      }
    }

    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}
