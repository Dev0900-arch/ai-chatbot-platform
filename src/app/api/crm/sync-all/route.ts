import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCRMIntegration, LeadData } from '@/lib/crm-integrations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, platform, intentScoreFilter } = body

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
      return NextResponse.json(
        { error: 'User not found' },
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
        }
      })
    }

    if (integrations.length === 0) {
      return NextResponse.json(
        { error: 'No active CRM integrations found' },
        { status: 404 }
      )
    }

    const leads = await prisma.lead.findMany({
      where: {
        userId: user.id,
        ...(intentScoreFilter && { intentScore: intentScoreFilter }),
      },
      orderBy: { createdAt: 'desc' },
    })

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads to sync',
        totalLeads: 0,
        results: []
      })
    }

    const platformResults: Record<string, { success: number; failed: number; errors: string[] }> = {}

    for (const integration of integrations) {
      platformResults[integration.platform] = {
        success: 0,
        failed: 0,
        errors: []
      }

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
          platformResults[integration.platform].errors.push('Failed to initialize CRM integration')
          continue
        }

        for (const lead of leads) {
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

          try {
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
              platformResults[integration.platform].success++
            } else {
              platformResults[integration.platform].failed++
              if (syncResult.error) {
                platformResults[integration.platform].errors.push(syncResult.error)
              }
            }
          } catch (error) {
            platformResults[integration.platform].failed++
            platformResults[integration.platform].errors.push(String(error))
          }
        }

        const hasErrors = platformResults[integration.platform].failed > 0
        await prisma.cRMIntegration.update({
          where: { id: integration.id },
          data: {
            lastSyncAt: new Date(),
            syncStatus: hasErrors ? 'error' : 'connected',
            syncError: hasErrors ? platformResults[integration.platform].errors[0] : null,
          }
        })
      } catch (error) {
        console.error(`Bulk sync error for ${integration.platform}:`, error)
        platformResults[integration.platform].errors.push(String(error))
      }
    }

    return NextResponse.json({
      success: true,
      totalLeads: leads.length,
      results: Object.entries(platformResults).map(([platform, stats]) => ({
        platform,
        success: stats.success,
        failed: stats.failed,
        errors: stats.errors.length > 0 ? stats.errors.slice(0, 5) : undefined,
      }))
    })
  } catch (error) {
    console.error('Bulk sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync leads' },
      { status: 500 }
    )
  }
}
