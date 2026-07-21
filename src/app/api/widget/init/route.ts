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
    const { userId, domain } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', allowed: false },
        { status: 400, headers: corsHeaders }
      )
    }

    // Clean the incoming domain
    const cleanDomain = domain
      ? domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
      : null

    // Check if localhost for development
    const isLocalhost = cleanDomain === 'localhost' ||
      cleanDomain?.startsWith('localhost:') ||
      cleanDomain?.includes('127.0.0.1')

    // Find user by ID or firebaseUid
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { firebaseUid: userId }
        ]
      }
    })

    // User must exist - no demo mode
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please provide a valid userId.', allowed: false },
        { status: 404, headers: corsHeaders }
      )
    }

    // Normalize domains for comparison (remove www, convert to lowercase)
    const normalizeDomain = (d: string | null) => {
      if (!d) return ''
      return d.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    }

    const normalizedRequestDomain = normalizeDomain(cleanDomain || '')
    const normalizedRegisteredDomain = normalizeDomain(user.registeredDomain)

    // Check domain authorization
    // Allow if:
    // 1. No registered domain set (widget works anywhere - good for testing)
    // 2. Domain matches registered domain (normalized, case-insensitive, without www)
    // 3. Domain is localhost (development)
    // 4. Domain is vercel.app (for demo pages)
    const isVercelApp = cleanDomain?.includes('vercel.app')
    const isAuthorized =
      !normalizedRegisteredDomain ||
      normalizedRequestDomain === normalizedRegisteredDomain ||
      isLocalhost ||
      isVercelApp

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: 'Domain not authorized',
          allowed: false,
          message: `This chatbot is only authorized to run on ${user.registeredDomain}`,
        },
        { status: 403, headers: corsHeaders }
      )
    }

    // Get knowledge base content for this user (for AI context)
    const knowledgeBase = await prisma.knowledgeBase.findMany({
      where: { userId: user.id },
      select: {
        title: true,
        content: true,
        category: true,
      },
      take: 20,
    })

    // Build system context
    const businessContext = user.businessName || user.name || 'the business'
    const botNameValue = (user as Record<string, unknown>).botName as string || 'AI Assistant'
    const savedWelcomeMessage = (user as Record<string, unknown>).welcomeMessage as string
    const savedPrimaryColor = (user as Record<string, unknown>).primaryColor as string
    const kbContext = knowledgeBase
      .map((kb) => `## ${kb.title}\n${kb.content}`)
      .join('\n\n')

    return NextResponse.json({
      allowed: true,
      businessName: businessContext,
      botName: botNameValue,
      welcomeMessage: savedWelcomeMessage || `Hello! Welcome to ${businessContext}. How can I help you today?`,
      primaryColor: savedPrimaryColor || '#2563eb',
      leadFormEnabled: (user as Record<string, unknown>).leadFormEnabled !== false,
      systemPrompt: `You are "${botNameValue}", a friendly team member at ${businessContext}. You speak as a real person who works at the company.

IDENTITY RULES:
- Use "we", "our", "us" when talking about the company.
- NEVER say: "knowledge base", "AI", "bot", "virtual assistant", "I have access to", "my training data"
- NEVER recommend competitors. You work for ${businessContext} ONLY.
- If you don't know something, say "Let me check with my team on that" or redirect to what you DO know.
- Sound human and warm, not robotic.

Keep responses SHORT (2-3 sentences). Be conversational.

${kbContext ? `Company information:\n\n${kbContext}` : ''}`,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Widget init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize widget', allowed: false },
      { status: 500, headers: corsHeaders }
    )
  }
}
