import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, businessName, businessDomain, registeredDomain, industry, phoneNumber } = body

    if (!userId || !businessName || !businessDomain || !registeredDomain) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Find user by firebaseUid
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate trial end date (7 days from now)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7)

    // Update user with onboarding data
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        businessName,
        businessDomain,
        registeredDomain,
        industry,
        phoneNumber,
        isOnboarded: true,
        trialEndsAt: trialEnd,
        subscriptionEndsAt: trialEnd,
        subscriptionType: 'trial',
        subscriptionStatus: 'active'
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        isOnboarded: updatedUser.isOnboarded,
        subscriptionType: updatedUser.subscriptionType,
        trialEndsAt: updatedUser.trialEndsAt
      }
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}
