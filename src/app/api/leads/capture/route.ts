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
    const { userId, visitorId, conversationId, name, email, phone, sourcePageUrl, source } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    // User must exist - no demo mode
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please provide a valid userId.' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Check if lead already exists with this email or visitorId
    let existingLead = null

    if (email && email !== `visitor_${visitorId}@unknown.com`) {
      existingLead = await prisma.lead.findFirst({
        where: { userId: user.id, email }
      })
    }

    if (!existingLead && visitorId) {
      // Check by conversation
      const conversation = await prisma.conversation.findFirst({
        where: { visitorId, userId: user.id },
        include: { lead: true }
      })
      if (conversation?.lead) {
        existingLead = conversation.lead
      }
    }

    if (existingLead) {
      // Update existing lead with new info
      const updatedLead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name: name || existingLead.name,
          email: email || existingLead.email,
          phone: phone || existingLead.phone,
          sourcePageUrl: sourcePageUrl || existingLead.sourcePageUrl
        }
      })

      // Link conversation if provided
      if (conversationId) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { leadId: updatedLead.id }
        }).catch(() => {}) // Ignore if already linked
      }

      return NextResponse.json({ success: true, lead: updatedLead, updated: true }, { headers: corsHeaders })
    }

    // Create new lead
    const lead = await prisma.lead.create({
      data: {
        userId: user.id,
        name: name || 'Website Visitor',
        email: email || `visitor_${visitorId || Date.now()}@unknown.com`,
        phone,
        source: source || 'chatbot_widget',
        sourcePageUrl,
        status: 'new'
      }
    })

    // Link conversation if provided
    if (conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { leadId: lead.id }
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, lead, created: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Lead capture error:', error)
    return NextResponse.json(
      { error: 'Failed to capture lead' },
      { status: 500, headers: corsHeaders }
    )
  }
}
