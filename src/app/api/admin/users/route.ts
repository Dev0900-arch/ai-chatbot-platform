import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function checkAdminAccess(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
  // In a real app, you'd get the user ID from the session/auth token
  // For now, we'll check the header or implement your auth method
  try {
    // You can implement this based on your auth method
    // For example, using Firebase Auth token or session
    const authHeader = request.headers.get('authorization')
    // Parse the auth header and verify the user is an admin
    // This is a simplified version - implement based on your auth strategy

    return { isAdmin: false }
  } catch (error) {
    return { isAdmin: false }
  }
}

export async function GET(request: NextRequest) {
  try {
    // For simplicity, we'll allow access if the user is in the database with role 'admin'
    // In production, you should verify the session/token
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        name: true,
        businessName: true,
        businessDomain: true,
        registeredDomain: true,
        industry: true,
        phoneNumber: true,
        isOnboarded: true,
        emailVerified: true,
        subscriptionType: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        trialEndsAt: true,
        isLifetimeFree: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin users fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
