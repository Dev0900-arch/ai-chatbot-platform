import { NextRequest, NextResponse } from 'next/server'
import { prisma, getPrismaErrorMessage, checkDatabaseConnection } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Check database connection first
    const dbCheck = await checkDatabaseConnection()
    if (!dbCheck.connected) {
      return NextResponse.json(
        { error: dbCheck.error || 'Database connection failed' },
        { status: 503 }
      )
    }

    // Find user by id or firebaseUid
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { firebaseUid: userId }
        ]
      }
    })

    if (!user) {
      // Return empty stats for users not yet synced (new users)
      return NextResponse.json({
        stats: {
          totalConversations: 0,
          conversationsLast30Days: 0,
          conversationChange: 0,
          totalLeads: 0,
          leadsLast30Days: 0,
          leadsChange: 0,
          totalKnowledgeArticles: 0,
          hotLeads: 0,
          warmLeads: 0,
          coldLeads: 0,
          convertedLeads: 0,
          totalMessages: 0,
          messagesLast30Days: 0,
          uniqueVisitors: 0,
          responseRate: 0
        },
        recentConversations: [],
        recentLeads: []
      })
    }

    // Get date ranges for comparison
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // Get conversation stats
    const [
      totalConversations,
      conversationsLast30Days,
      conversationsPrevious30Days,
      totalLeads,
      leadsLast30Days,
      leadsPrevious30Days,
      totalKnowledgeArticles,
      hotLeads,
      warmLeads,
      coldLeads,
      convertedLeads,
      recentConversations,
      recentLeads,
      totalMessages,
      messagesLast30Days
    ] = await Promise.all([
      // Total conversations
      prisma.conversation.count({
        where: { userId: user.id }
      }),
      // Conversations last 30 days
      prisma.conversation.count({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      // Conversations previous 30 days (for comparison)
      prisma.conversation.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      }),
      // Total leads
      prisma.lead.count({
        where: { userId: user.id }
      }),
      // Leads last 30 days
      prisma.lead.count({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      // Leads previous 30 days (for comparison)
      prisma.lead.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      }),
      // Total knowledge base articles
      prisma.knowledgeBase.count({
        where: { userId: user.id }
      }),
      // Hot leads
      prisma.lead.count({
        where: { userId: user.id, intentScore: 'hot' }
      }),
      // Warm leads
      prisma.lead.count({
        where: { userId: user.id, intentScore: 'warm' }
      }),
      // Cold leads
      prisma.lead.count({
        where: { userId: user.id, intentScore: 'cold' }
      }),
      // Converted leads
      prisma.lead.count({
        where: { userId: user.id, status: 'converted' }
      }),
      // Recent conversations (last 5)
      prisma.conversation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          lead: {
            select: {
              intentScore: true
            }
          }
        }
      }),
      // Recent leads (last 5)
      prisma.lead.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      // Total messages
      prisma.message.count({
        where: {
          conversation: {
            userId: user.id
          }
        }
      }),
      // Messages last 30 days
      prisma.message.count({
        where: {
          conversation: {
            userId: user.id
          },
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ])

    // Active conversations: truly active right now
    // Must have a message within last 5 minutes AND not be explicitly closed
    const recentActiveConversations = await prisma.conversation.findMany({
      where: {
        userId: user.id,
        isClosed: false,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    // Only count as active if the last message is truly within 5 minutes
    const activeConversations = recentActiveConversations.filter(conv => {
      const lastMsg = conv.messages[0]
      if (!lastMsg) return false
      return lastMsg.createdAt.getTime() >= fiveMinutesAgo.getTime()
    }).length

    // Closed = total minus active
    const closedConversations = totalConversations - activeConversations

    console.log(`[Stats] Total: ${totalConversations}, Active: ${activeConversations}, Closed: ${closedConversations}, Checked: ${recentActiveConversations.length} non-closed convos`)

    // Calculate percentage changes
    const conversationChange = conversationsPrevious30Days > 0
      ? Math.round(((conversationsLast30Days - conversationsPrevious30Days) / conversationsPrevious30Days) * 100)
      : conversationsLast30Days > 0 ? 100 : 0

    const leadsChange = leadsPrevious30Days > 0
      ? Math.round(((leadsLast30Days - leadsPrevious30Days) / leadsPrevious30Days) * 100)
      : leadsLast30Days > 0 ? 100 : 0

    // Get unique visitors (unique visitorIds in conversations)
    const uniqueVisitors = await prisma.conversation.groupBy({
      by: ['visitorId'],
      where: {
        userId: user.id,
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    // Calculate response rate (conversations with at least 2 messages / total conversations)
    const conversationsWithResponses = await prisma.conversation.count({
      where: {
        userId: user.id,
        messages: {
          some: {
            role: 'assistant'
          }
        }
      }
    })
    const responseRate = totalConversations > 0
      ? Math.round((conversationsWithResponses / totalConversations) * 100)
      : 0

    return NextResponse.json({
      stats: {
        totalConversations,
        conversationsLast30Days,
        conversationChange,
        totalLeads,
        leadsLast30Days,
        leadsChange,
        totalKnowledgeArticles,
        hotLeads,
        warmLeads,
        coldLeads,
        convertedLeads,
        totalMessages,
        messagesLast30Days,
        uniqueVisitors: uniqueVisitors.length,
        responseRate,
        activeConversations,
        closedConversations
      },
      recentConversations: recentConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        visitorId: conv.visitorId,
        createdAt: conv.createdAt,
        lastMessage: conv.messages[0]?.content || null,
        intentScore: conv.lead?.intentScore || null
      })),
      recentLeads: recentLeads.map(lead => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
        intentScore: lead.intentScore,
        createdAt: lead.createdAt
      }))
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}
