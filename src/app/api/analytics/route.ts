import { NextRequest, NextResponse } from 'next/server'
import { prisma, getPrismaErrorMessage, checkDatabaseConnection } from '@/lib/prisma'

type TimePeriod = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

interface DateRange {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

function getDateRange(period: TimePeriod, startDate?: string | null, endDate?: string | null): DateRange {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  switch (period) {
    case 'today': {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000)
      return {
        start: todayStart,
        end: todayEnd,
        previousStart: yesterdayStart,
        previousEnd: yesterdayEnd
      }
    }

    case 'weekly': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      return {
        start: weekAgo,
        end: now,
        previousStart: twoWeeksAgo,
        previousEnd: weekAgo
      }
    }

    case 'monthly': {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate())
      return {
        start: monthAgo,
        end: now,
        previousStart: twoMonthsAgo,
        previousEnd: monthAgo
      }
    }

    case 'quarterly': {
      const quarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      const twoQuartersAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      return {
        start: quarterAgo,
        end: now,
        previousStart: twoQuartersAgo,
        previousEnd: quarterAgo
      }
    }

    case 'yearly': {
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
      return {
        start: yearAgo,
        end: now,
        previousStart: twoYearsAgo,
        previousEnd: yearAgo
      }
    }

    case 'custom': {
      if (!startDate || !endDate) {
        // Default to last 30 days if custom range not provided
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        return {
          start: thirtyDaysAgo,
          end: now,
          previousStart: sixtyDaysAgo,
          previousEnd: thirtyDaysAgo
        }
      }
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      const duration = end.getTime() - start.getTime()
      const previousStart = new Date(start.getTime() - duration)
      const previousEnd = new Date(start.getTime() - 1)
      return { start, end, previousStart, previousEnd }
    }

    default: {
      // Default to weekly
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      return {
        start: weekAgo,
        end: now,
        previousStart: twoWeeksAgo,
        previousEnd: weekAgo
      }
    }
  }
}

interface AnalyticsData {
  period: string
  dateRange: { start: string; end: string }
  metrics: {
    totalConversations: number
    conversationsChange: number
    totalMessages: number
    messagesChange: number
    uniqueVisitors: number
    visitorsChange: number
    avgSessionDuration: string
    resolutionRate: number
    responseRate: number
  }
  leads: {
    total: number
    hot: number
    warm: number
    cold: number
    conversionRate: number
  }
  topQueries: { query: string; count: number; percentage: number }[]
  peakHours: { hour: string; messages: number }[]
  dailyTrend: { date: string; conversations: number; leads: number }[]
  topSourcePages: { url: string; count: number }[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const period = (searchParams.get('period') || 'weekly') as TimePeriod
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

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
      // Return empty analytics for users not yet synced
      const emptyData: AnalyticsData = {
        period,
        dateRange: { start: '', end: '' },
        metrics: {
          totalConversations: 0,
          conversationsChange: 0,
          totalMessages: 0,
          messagesChange: 0,
          uniqueVisitors: 0,
          visitorsChange: 0,
          avgSessionDuration: '0m 0s',
          resolutionRate: 0,
          responseRate: 0
        },
        leads: { total: 0, hot: 0, warm: 0, cold: 0, conversionRate: 0 },
        topQueries: [],
        peakHours: [
          { hour: '9:00 AM - 12:00 PM', messages: 0 },
          { hour: '12:00 PM - 3:00 PM', messages: 0 },
          { hour: '3:00 PM - 6:00 PM', messages: 0 },
          { hour: '6:00 PM - 9:00 PM', messages: 0 },
        ],
        dailyTrend: [],
        topSourcePages: []
      }

      return NextResponse.json(emptyData)
    }

    // Calculate date range
    const dateRange = getDateRange(period, startDate, endDate)

    // Get all data in parallel
    const [
      conversationsInPeriod,
      conversationsPrevious,
      messagesInPeriod,
      messagesPrevious,
      conversationsWithMessages,
      leadsInPeriod
    ] = await Promise.all([
      prisma.conversation.count({
        where: {
          userId: user.id,
          createdAt: { gte: dateRange.start, lte: dateRange.end }
        }
      }),
      prisma.conversation.count({
        where: {
          userId: user.id,
          createdAt: { gte: dateRange.previousStart, lte: dateRange.previousEnd }
        }
      }),
      prisma.message.count({
        where: {
          conversation: { userId: user.id },
          createdAt: { gte: dateRange.start, lte: dateRange.end }
        }
      }),
      prisma.message.count({
        where: {
          conversation: { userId: user.id },
          createdAt: { gte: dateRange.previousStart, lte: dateRange.previousEnd }
        }
      }),
      prisma.conversation.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: dateRange.start, lte: dateRange.end }
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } }
        }
      }),
      prisma.lead.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: dateRange.start, lte: dateRange.end }
        }
      })
    ])

    // Calculate unique visitors
    const uniqueVisitors = await prisma.conversation.groupBy({
      by: ['visitorId'],
      where: {
        userId: user.id,
        createdAt: { gte: dateRange.start, lte: dateRange.end }
      }
    })

    const uniqueVisitorsPrevious = await prisma.conversation.groupBy({
      by: ['visitorId'],
      where: {
        userId: user.id,
        createdAt: { gte: dateRange.previousStart, lte: dateRange.previousEnd }
      }
    })

    // Calculate average session duration
    let totalDurationMs = 0
    let sessionsWithDuration = 0

    for (const conv of conversationsWithMessages) {
      if (conv.messages.length >= 2) {
        const firstMsg = new Date(conv.messages[0].createdAt).getTime()
        const lastMsg = new Date(conv.messages[conv.messages.length - 1].createdAt).getTime()
        const duration = lastMsg - firstMsg
        if (duration > 0 && duration < 3600000) {
          totalDurationMs += duration
          sessionsWithDuration++
        }
      }
    }

    const avgSessionDuration = sessionsWithDuration > 0
      ? Math.round(totalDurationMs / sessionsWithDuration / 1000)
      : 0

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}m ${secs}s`
    }

    // Calculate resolution rate
    let resolvedCount = 0
    for (const conv of conversationsWithMessages) {
      const userMsgs = conv.messages.filter(m => m.role === 'user').length
      const assistantMsgs = conv.messages.filter(m => m.role === 'assistant').length
      if (userMsgs >= 1 && assistantMsgs >= 1) {
        resolvedCount++
      }
    }

    const resolutionRate = conversationsInPeriod > 0
      ? Math.round((resolvedCount / conversationsInPeriod) * 100)
      : 0

    // Calculate response rate (conversations with at least one assistant response)
    const responseRate = conversationsInPeriod > 0
      ? Math.round((resolvedCount / conversationsInPeriod) * 100)
      : 0

    // Get top user queries
    const userMessages = await prisma.message.findMany({
      where: {
        conversation: { userId: user.id },
        role: 'user',
        createdAt: { gte: dateRange.start, lte: dateRange.end }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    })

    const queryPatterns: Record<string, number> = {}
    const commonQueries = [
      { pattern: /pricing|price|cost|how much/i, label: 'Pricing inquiries' },
      { pattern: /support|help|issue|problem/i, label: 'Support requests' },
      { pattern: /demo|trial|try/i, label: 'Demo requests' },
      { pattern: /contact|call|phone|email/i, label: 'Contact information' },
      { pattern: /feature|capability|can you|do you/i, label: 'Feature questions' },
      { pattern: /account|login|password|signup/i, label: 'Account questions' },
      { pattern: /refund|cancel|subscription/i, label: 'Billing questions' },
      { pattern: /shipping|delivery|order/i, label: 'Order inquiries' },
    ]

    for (const msg of userMessages) {
      for (const q of commonQueries) {
        if (q.pattern.test(msg.content)) {
          queryPatterns[q.label] = (queryPatterns[q.label] || 0) + 1
        }
      }
    }

    const topQueries = Object.entries(queryPatterns)
      .map(([query, count]) => ({
        query,
        count,
        percentage: userMessages.length > 0 ? Math.round((count / userMessages.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate peak hours
    const hourDistribution: Record<number, number> = {}
    for (let i = 0; i < 24; i++) hourDistribution[i] = 0

    for (const conv of conversationsWithMessages) {
      const hour = new Date(conv.createdAt).getHours()
      hourDistribution[hour]++
    }

    const peakHours = [
      { hour: '9:00 AM - 12:00 PM', messages: hourDistribution[9] + hourDistribution[10] + hourDistribution[11] },
      { hour: '12:00 PM - 3:00 PM', messages: hourDistribution[12] + hourDistribution[13] + hourDistribution[14] },
      { hour: '3:00 PM - 6:00 PM', messages: hourDistribution[15] + hourDistribution[16] + hourDistribution[17] },
      { hour: '6:00 PM - 9:00 PM', messages: hourDistribution[18] + hourDistribution[19] + hourDistribution[20] },
    ]

    // Calculate percentage changes
    const conversationsChange = conversationsPrevious > 0
      ? Math.round(((conversationsInPeriod - conversationsPrevious) / conversationsPrevious) * 100)
      : conversationsInPeriod > 0 ? 100 : 0

    const messagesChange = messagesPrevious > 0
      ? Math.round(((messagesInPeriod - messagesPrevious) / messagesPrevious) * 100)
      : messagesInPeriod > 0 ? 100 : 0

    const visitorsChange = uniqueVisitorsPrevious.length > 0
      ? Math.round(((uniqueVisitors.length - uniqueVisitorsPrevious.length) / uniqueVisitorsPrevious.length) * 100)
      : uniqueVisitors.length > 0 ? 100 : 0

    // Calculate lead metrics
    const hotLeads = leadsInPeriod.filter(l => l.intentScore === 'hot').length
    const warmLeads = leadsInPeriod.filter(l => l.intentScore === 'warm').length
    const coldLeads = leadsInPeriod.filter(l => l.intentScore === 'cold').length
    const convertedLeads = leadsInPeriod.filter(l => l.status === 'converted').length
    const conversionRate = leadsInPeriod.length > 0
      ? Math.round((convertedLeads / leadsInPeriod.length) * 100)
      : 0

    // Calculate daily trend
    const dailyTrend: { date: string; conversations: number; leads: number }[] = []
    const daysInRange = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000))
    const maxDays = Math.min(daysInRange, 90) // Limit to 90 days for performance

    for (let i = maxDays - 1; i >= 0; i--) {
      const date = new Date(dateRange.end.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]

      const convCount = conversationsWithMessages.filter(c => {
        const convDate = new Date(c.createdAt).toISOString().split('T')[0]
        return convDate === dateStr
      }).length

      const leadCount = leadsInPeriod.filter(l => {
        const leadDate = new Date(l.createdAt).toISOString().split('T')[0]
        return leadDate === dateStr
      }).length

      dailyTrend.push({ date: dateStr, conversations: convCount, leads: leadCount })
    }

    // Calculate top source pages
    const sourcePageCounts: Record<string, number> = {}
    for (const conv of conversationsWithMessages) {
      if (conv.sourcePageUrl) {
        sourcePageCounts[conv.sourcePageUrl] = (sourcePageCounts[conv.sourcePageUrl] || 0) + 1
      }
    }

    const topSourcePages = Object.entries(sourcePageCounts)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const analyticsData: AnalyticsData = {
      period,
      dateRange: {
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0]
      },
      metrics: {
        totalConversations: conversationsInPeriod,
        conversationsChange,
        totalMessages: messagesInPeriod,
        messagesChange,
        uniqueVisitors: uniqueVisitors.length,
        visitorsChange,
        avgSessionDuration: formatDuration(avgSessionDuration),
        resolutionRate,
        responseRate
      },
      leads: {
        total: leadsInPeriod.length,
        hot: hotLeads,
        warm: warmLeads,
        cold: coldLeads,
        conversionRate
      },
      topQueries,
      peakHours,
      dailyTrend,
      topSourcePages
    }

    return NextResponse.json(analyticsData)
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}
