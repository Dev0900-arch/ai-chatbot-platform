import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, subscriptionType, isLifetimeFree } = body

    if (!userId || !subscriptionType) {
      return NextResponse.json(
        { error: 'User ID and subscription type are required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate subscription dates based on type
    let updateData: any = {
      subscriptionType,
      isLifetimeFree: isLifetimeFree || false
    }

    if (isLifetimeFree) {
      // Lifetime free - no expiration
      updateData.subscriptionStatus = 'active'
      updateData.subscriptionEndsAt = null
      updateData.trialEndsAt = null
    } else if (subscriptionType === 'trial') {
      // 7-day trial
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 7)
      updateData.trialEndsAt = trialEnd
      updateData.subscriptionEndsAt = trialEnd
      updateData.subscriptionStatus = 'active'
    } else if (subscriptionType === 'paid') {
      // Monthly paid subscription
      const paidEnd = new Date()
      paidEnd.setMonth(paidEnd.getMonth() + 1)
      updateData.subscriptionEndsAt = paidEnd
      updateData.trialEndsAt = null
      updateData.subscriptionStatus = 'active'
    } else if (subscriptionType === 'expired') {
      // Mark as expired
      updateData.subscriptionStatus = 'expired'
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        subscriptionType: updatedUser.subscriptionType,
        subscriptionStatus: updatedUser.subscriptionStatus,
        subscriptionEndsAt: updatedUser.subscriptionEndsAt,
        isLifetimeFree: updatedUser.isLifetimeFree
      }
    })
  } catch (error) {
    console.error('Update subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
}
