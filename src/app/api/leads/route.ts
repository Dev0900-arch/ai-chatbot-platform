import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const intentScore = searchParams.get('intentScore')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find user by id or firebaseUid
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json({ leads: [] })
    }

    const leads = await prisma.lead.findMany({
      where: {
        userId: user.id,
        ...(status && { status }),
        ...(intentScore && { intentScore }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ leads })
  } catch (error) {
    console.error('Leads GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, email, phone, source, notes } = body

    if (!userId || !name || !email) {
      return NextResponse.json(
        { error: 'User ID, name, and email are required' },
        { status: 400 }
      )
    }

    // Find user by id or firebaseUid
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const lead = await prisma.lead.create({
      data: {
        userId: user.id,
        name,
        email,
        phone,
        source,
        notes,
      },
    })

    // Auto-sync to CRM if enabled (don't await - run in background)
    try {
      const autoSyncIntegrations = await prisma.cRMIntegration.findMany({
        where: {
          userId: user.id,
          isActive: true,
          autoSync: true,
        }
      })

      if (autoSyncIntegrations.length > 0) {
        // Trigger sync in background without blocking response
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/crm/sync-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            userId: user.id,
          })
        }).catch(err => console.error('Auto-sync failed:', err))
      }
    } catch (err) {
      console.error('Auto-sync check failed:', err)
    }

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Leads POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, leadId, userId, status, notes, intentScore, conversationSummary, aiRecommendation } = body

    const actualId = id || leadId

    if (!actualId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    // If userId provided, verify ownership (for dashboard updates)
    if (userId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { firebaseUid: userId }] }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      const existingLead = await prisma.lead.findFirst({
        where: { id: actualId, userId: user.id }
      })

      if (!existingLead) {
        return NextResponse.json(
          { error: 'Lead not found or not authorized' },
          { status: 404 }
        )
      }
    }

    const lead = await prisma.lead.update({
      where: { id: actualId },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(intentScore && { intentScore }),
        ...(conversationSummary && { conversationSummary }),
        ...(aiRecommendation && { aiRecommendation }),
      },
    })

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Leads PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const existingLead = await prisma.lead.findFirst({
      where: { id, userId: user.id }
    })

    if (!existingLead) {
      return NextResponse.json(
        { error: 'Lead not found or not authorized' },
        { status: 404 }
      )
    }

    await prisma.lead.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Leads DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    )
  }
}
