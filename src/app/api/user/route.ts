import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Get user settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const firebaseUid = searchParams.get('firebaseUid')

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Firebase UID is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { firebaseUid },
    })

    // User should exist from auth sync - if not, return null (frontend will handle)
    if (!user) {
      return NextResponse.json({
        firebaseUid,
        botName: 'AI Assistant',
        welcomeMessage: 'Hello! How can I help you today?',
        primaryColor: '#2563eb',
        aiModel: 'openai/gpt-3.5-turbo',
        leadFormEnabled: true,
      })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('User GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// Update user settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firebaseUid,
      email,
      name,
      registeredDomain,
      businessName,
      botName,
      welcomeMessage,
      primaryColor,
      aiModel,
      leadFormEnabled
    } = body

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Firebase UID is required' },
        { status: 400 }
      )
    }

    // Validate domain format if provided
    if (registeredDomain) {
      // Remove protocol and trailing slashes
      const cleanDomain = registeredDomain
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '')
        .toLowerCase()

      // Basic domain validation
      const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/
      if (!domainRegex.test(cleanDomain) && cleanDomain !== 'localhost') {
        return NextResponse.json(
          { error: 'Invalid domain format. Example: example.com' },
          { status: 400 }
        )
      }
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { firebaseUid },
    })

    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { firebaseUid },
        data: {
          ...(email && { email }),
          ...(name !== undefined && { name }),
          ...(registeredDomain !== undefined && {
            registeredDomain: registeredDomain
              ? registeredDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()
              : null,
          }),
          ...(businessName !== undefined && { businessName }),
          ...(botName !== undefined && { botName }),
          ...(welcomeMessage !== undefined && { welcomeMessage }),
          ...(primaryColor !== undefined && { primaryColor }),
          ...(aiModel !== undefined && { aiModel }),
          ...(leadFormEnabled !== undefined && { leadFormEnabled }),
        },
      })
    } else {
      // User should be created via auth sync, but handle edge case
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required to create user. Please sign in again.' },
          { status: 400 }
        )
      }

      // Create new user with required email
      user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
          name,
          registeredDomain: registeredDomain
            ? registeredDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()
            : null,
          businessName,
          botName,
          welcomeMessage,
          primaryColor,
          aiModel,
          leadFormEnabled: leadFormEnabled !== undefined ? leadFormEnabled : true,
        },
      })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update user settings' },
      { status: 500 }
    )
  }
}
