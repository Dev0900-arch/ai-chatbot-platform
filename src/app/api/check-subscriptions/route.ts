import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const now = new Date()

    // Find all users with expired subscriptions
    const expiredUsers = await prisma.user.findMany({
      where: {
        subscriptionEndsAt: { lte: now },
        isLifetimeFree: false,
        subscriptionStatus: 'active'
      }
    })

    // Update their status to expired
    const updatePromises = expiredUsers.map(user =>
      prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'expired' }
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      expired: expiredUsers.length,
      users: expiredUsers.map(u => ({
        id: u.id,
        email: u.email,
        subscriptionEndsAt: u.subscriptionEndsAt
      }))
    })
  } catch (error) {
    console.error('Check subscriptions error:', error)
    return NextResponse.json(
      { error: 'Failed to check subscriptions' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Also allow GET for easier cron job setup
  return POST()
}
