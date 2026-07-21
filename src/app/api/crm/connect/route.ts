import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptApiKey, getCRMIntegration } from '@/lib/crm-integrations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, platform, apiKey, apiSecret, domain, accessToken, refreshToken, autoSync } = body

    if (!userId || !platform) {
      return NextResponse.json(
        { error: 'User ID and platform are required' },
        { status: 400 }
      )
    }

    const validPlatforms = ['hubspot', 'salesforce', 'pipedrive', 'close', 'zoho', 'instantly']
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid platform' },
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

    const encryptedConfig = {
      ...(apiKey && { apiKey: encryptApiKey(apiKey) }),
      ...(apiSecret && { apiSecret: encryptApiKey(apiSecret) }),
      domain,
      ...(accessToken && { accessToken: encryptApiKey(accessToken) }),
      ...(refreshToken && { refreshToken: encryptApiKey(refreshToken) }),
    }

    const integration = getCRMIntegration(platform, encryptedConfig)
    if (!integration) {
      return NextResponse.json(
        { error: 'Failed to initialize CRM integration' },
        { status: 500 }
      )
    }

    let isConnected = false
    let connectionError = ''
    try {
      isConnected = await integration.testConnection()
    } catch (err: unknown) {
      connectionError = err instanceof Error ? err.message : 'Unknown connection error'
    }

    if (!isConnected) {
      return NextResponse.json(
        {
          error: 'Failed to connect to CRM. Please check your credentials.',
          details: connectionError || 'Connection test returned false. Verify your API key and permissions.'
        },
        { status: 400 }
      )
    }

    const existingIntegration = await prisma.cRMIntegration.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: platform.toLowerCase()
        }
      }
    })

    let crmIntegration
    if (existingIntegration) {
      crmIntegration = await prisma.cRMIntegration.update({
        where: { id: existingIntegration.id },
        data: {
          isActive: true,
          apiKey: encryptedConfig.apiKey,
          apiSecret: encryptedConfig.apiSecret,
          domain: encryptedConfig.domain,
          accessToken: encryptedConfig.accessToken,
          refreshToken: encryptedConfig.refreshToken,
          autoSync: autoSync || false,
          syncStatus: 'connected',
          syncError: null,
          lastSyncAt: new Date(),
        }
      })
    } else {
      crmIntegration = await prisma.cRMIntegration.create({
        data: {
          userId: user.id,
          platform: platform.toLowerCase(),
          isActive: true,
          apiKey: encryptedConfig.apiKey,
          apiSecret: encryptedConfig.apiSecret,
          domain: encryptedConfig.domain,
          accessToken: encryptedConfig.accessToken,
          refreshToken: encryptedConfig.refreshToken,
          autoSync: autoSync || false,
          syncStatus: 'connected',
          lastSyncAt: new Date(),
        }
      })
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: crmIntegration.id,
        platform: crmIntegration.platform,
        isActive: crmIntegration.isActive,
        autoSync: crmIntegration.autoSync,
        syncStatus: crmIntegration.syncStatus,
        lastSyncAt: crmIntegration.lastSyncAt,
      }
    })
  } catch (error) {
    console.error('CRM connect error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to CRM' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json({ integrations: [] })
    }

    const integrations = await prisma.cRMIntegration.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        platform: true,
        isActive: true,
        autoSync: true,
        syncStatus: true,
        syncError: true,
        lastSyncAt: true,
        createdAt: true,
        domain: true,
      }
    })

    return NextResponse.json({ integrations })
  } catch (error) {
    console.error('Fetch CRM integrations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    )
  }
}
