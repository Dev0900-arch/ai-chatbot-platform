import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCRMIntegration, LeadData } from '@/lib/crm-integrations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, userId, platform } = body

    if (!leadId || !userId) {
      return NextResponse.json(
        { error: 'Lead ID and User ID are required' },
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: user.id }
    })

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found or not authorized' },
        { status: 404 }
      )
    }

    let integrations
    if (platform) {
      const integration = await prisma.cRMIntegration.findUnique({
        where: {
          userId_platform: {
            userId: user.id,
            platform: platform.toLowerCase()
          }
        }
      })
      integrations = integration ? [integration] : []
    } else {
      integrations = await prisma.cRMIntegration.findMany({
        where: {
          userId: user.id,
          isActive: true,
          autoSync: true,
        }
      })
    }

    if (integrations.length === 0) {
      return NextResponse.json(
        { error: 'No active CRM integrations found' },
        { status: 404 }
      )
    }

    const leadData: LeadData = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone || undefined,
      source: lead.source || undefined,
      notes: lead.notes || undefined,
      conversationSummary: lead.conversationSummary || undefined,
      aiRecommendation: lead.aiRecommendation || undefined,
      intentScore: lead.intentScore || undefined,
    }

    const results = []

    for (const integration of integrations) {
      try {
        const crmConfig = {
          apiKey: integration.apiKey || undefined,
          apiSecret: integration.apiSecret || undefined,
          domain: integration.domain || undefined,
          accessToken: integration.accessToken || undefined,
          refreshToken: integration.refreshToken || undefined,
        }

        const crm = getCRMIntegration(integration.platform, crmConfig)
        if (!crm) {
          results.push({
            platform: integration.platform,
            success: false,
            error: 'Failed to initialize CRM integration'
          })
          continue
        }

        const syncResult = await crm.syncLead(leadData)

        await prisma.leadSyncLog.create({
          data: {
            crmIntegrationId: integration.id,
            leadId: lead.id,
            platform: integration.platform,
            status: syncResult.success ? 'success' : 'failed',
            externalLeadId: syncResult.externalLeadId,
            errorMessage: syncResult.error,
          }
        })

        if (syncResult.success) {
          await prisma.cRMIntegration.update({
            where: { id: integration.id },
            data: {
              lastSyncAt: new Date(),
              syncStatus: 'connected',
              syncError: null,
            }
          })
        } else {
          await prisma.cRMIntegration.update({
            where: { id: integration.id },
            data: {
              syncStatus: 'error',
              syncError: syncResult.error,
            }
          })
        }

        results.push({
          platform: integration.platform,
          success: syncResult.success,
          externalLeadId: syncResult.externalLeadId,
          error: syncResult.error,
        })
      } catch (error) {
        console.error(`Sync error for ${integration.platform}:`, error)
        results.push({
          platform: integration.platform,
          success: false,
          error: String(error)
        })
      }
    }

    return NextResponse.json({
      success: results.some(r => r.success),
      results
    })
  } catch (error) {
    console.error('Lead sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync lead' },
      { status: 500 }
    )
  }
}
