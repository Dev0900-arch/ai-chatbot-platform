import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const platform = searchParams.get('platform')

    if (!userId || !platform) {
      return NextResponse.json(
        { error: 'User ID and platform are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const integration = await prisma.cRMIntegration.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: platform.toLowerCase()
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'CRM integration not found' },
        { status: 404 }
      )
    }

    await prisma.cRMIntegration.delete({
      where: { id: integration.id }
    })

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${platform}`
    })
  } catch (error) {
    console.error('CRM disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect from CRM' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, platform, autoSync } = body

    if (!userId || !platform) {
      return NextResponse.json(
        { error: 'User ID and platform are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const integration = await prisma.cRMIntegration.update({
      where: {
        userId_platform: {
          userId: user.id,
          platform: platform.toLowerCase()
        }
      },
      data: {
        ...(autoSync !== undefined && { autoSync }),
      }
    })

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: integration.platform,
        isActive: integration.isActive,
        autoSync: integration.autoSync,
        syncStatus: integration.syncStatus,
        lastSyncAt: integration.lastSyncAt,
      }
    })
  } catch (error) {
    console.error('CRM update error:', error)
    return NextResponse.json(
      { error: 'Failed to update CRM integration' },
      { status: 500 }
    )
  }
}
