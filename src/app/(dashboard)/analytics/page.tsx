'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

type TimePeriod = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

interface Metrics {
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

interface Leads {
  total: number
  hot: number
  warm: number
  cold: number
  conversionRate: number
}

interface TopQuery {
  query: string
  count: number
  percentage: number
}

interface PeakHour {
  hour: string
  messages: number
}

interface DailyTrend {
  date: string
  conversations: number
  leads: number
}

interface TopSourcePage {
  url: string
  count: number
}

interface ExportRecord {
  id: string
  date: string
  count: number
  filter: string
}

interface ExportHistory {
  totalExports: number
  totalLeadsExported: number
  exports: ExportRecord[]
}

interface AnalyticsData {
  period: string
  dateRange: { start: string; end: string }
  metrics: Metrics
  leads: Leads
  topQueries: TopQuery[]
  peakHours: PeakHour[]
  dailyTrend: DailyTrend[]
  topSourcePages: TopSourcePage[]
}

const periodLabels: Record<TimePeriod, string> = {
  today: 'Today',
  weekly: 'Last 7 Days',
  monthly: 'Last 30 Days',
  quarterly: 'Last 90 Days',
  yearly: 'Last Year',
  custom: 'Custom Range'
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<TimePeriod>('weekly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportHistory, setExportHistory] = useState<ExportHistory | null>(null)

  // Set default custom dates
  useEffect(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (user?.uid) {
      fetchAnalytics()
      fetchExportHistory()
    }
  }, [user?.uid, period, startDate, endDate])

  const fetchExportHistory = async () => {
    try {
      const res = await fetch(`/api/leads/track-export?userId=${user?.uid}`)
      if (res.ok) {
        const data = await res.json()
        setExportHistory(data)
      }
    } catch (err) {
      console.error('Export history fetch error:', err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      let url = `/api/analytics?userId=${user?.uid}&period=${period}`
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }

      const res = await fetch(url)

      if (!res.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const analyticsData = await res.json()
      setData(analyticsData)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError('Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }

  const maxTrendValue = Math.max(...(data?.dailyTrend?.map(d => d.conversations) || []), 1)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
          <p className="text-gray-600 mt-1">
            Track your chatbot performance and insights
            {data?.dateRange && (
              <span className="text-sm ml-2 text-gray-500">
                ({data.dateRange.start} to {data.dateRange.end})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Period Filter */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as TimePeriod)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            <option value="today">Today</option>
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
            <option value="quarterly">Last 90 Days</option>
            <option value="yearly">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Custom Date Range */}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          {/* Refresh Button */}
          <Button variant="outline" onClick={fetchAnalytics}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm font-medium text-gray-600">Total Conversations</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-gray-900">{data?.metrics?.totalConversations?.toLocaleString() || 0}</p>
            {data?.metrics?.conversationsChange !== undefined && (
              <span className={`text-sm font-medium ${data.metrics.conversationsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.metrics.conversationsChange >= 0 ? '+' : ''}{data.metrics.conversationsChange}%
              </span>
            )}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">Total Messages</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-gray-900">{data?.metrics?.totalMessages?.toLocaleString() || 0}</p>
            {data?.metrics?.messagesChange !== undefined && (
              <span className={`text-sm font-medium ${data.metrics.messagesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.metrics.messagesChange >= 0 ? '+' : ''}{data.metrics.messagesChange}%
              </span>
            )}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">Unique Visitors</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-gray-900">{data?.metrics?.uniqueVisitors?.toLocaleString() || 0}</p>
            {data?.metrics?.visitorsChange !== undefined && (
              <span className={`text-sm font-medium ${data.metrics.visitorsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.metrics.visitorsChange >= 0 ? '+' : ''}{data.metrics.visitorsChange}%
              </span>
            )}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-600">Avg. Session Duration</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-gray-900">{data?.metrics?.avgSessionDuration || '0m 0s'}</p>
          </div>
        </Card>
      </div>

      {/* Lead Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-600">Total Leads</p>
          <p className="text-2xl font-bold text-gray-900">{data?.leads?.total || 0}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-red-500">
          <p className="text-sm text-gray-600 flex items-center">
            <span className="mr-1">🔥</span> Hot Leads
          </p>
          <p className="text-2xl font-bold text-red-600">{data?.leads?.hot || 0}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-orange-500">
          <p className="text-sm text-gray-600 flex items-center">
            <span className="mr-1">☀️</span> Warm Leads
          </p>
          <p className="text-2xl font-bold text-orange-600">{data?.leads?.warm || 0}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-600 flex items-center">
            <span className="mr-1">❄️</span> Cold Leads
          </p>
          <p className="text-2xl font-bold text-blue-600">{data?.leads?.cold || 0}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-green-500">
          <p className="text-sm text-gray-600">Conversion Rate</p>
          <p className="text-2xl font-bold text-green-600">{data?.leads?.conversionRate || 0}%</p>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversations & Leads Over Time</h3>
          {!data?.dailyTrend || data.dailyTrend.length === 0 ? (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-500">No data available for {periodLabels[period]}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-64 flex items-end gap-1 bg-gray-50 rounded-lg p-4">
                {data.dailyTrend.slice(-14).map((day, i) => {
                  const height = maxTrendValue > 0 ? (day.conversations / maxTrendValue) * 100 : 0
                  const leadHeight = maxTrendValue > 0 ? (day.leads / maxTrendValue) * 100 : 0
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                      <div
                        className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors min-h-[4px]"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      {day.leads > 0 && (
                        <div
                          className="w-full bg-green-500 rounded-t min-h-[4px] -mt-1"
                          style={{ height: `${Math.max(leadHeight, 2)}%` }}
                        />
                      )}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {day.date}<br />
                        {day.conversations} conv, {day.leads} leads
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{data.dailyTrend.length > 0 ? new Date(data.dailyTrend[Math.max(0, data.dailyTrend.length - 14)]?.date).toLocaleDateString() : ''}</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center"><span className="w-3 h-3 bg-primary-500 rounded mr-1"></span>Conversations</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded mr-1"></span>Leads</span>
                </div>
                <span>{data.dailyTrend.length > 0 ? new Date(data.dailyTrend[data.dailyTrend.length - 1]?.date).toLocaleDateString() : ''}</span>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Hours</h3>
          {!data?.peakHours || data.peakHours.every(h => h.messages === 0) ? (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500">No data available</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.peakHours.map((item, i) => {
                const maxMessages = Math.max(...data.peakHours.map(h => h.messages), 1)
                const percentage = (item.messages / maxMessages) * 100
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 w-36">{item.hour}</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-24 text-right">
                      {item.messages.toLocaleString()} conv.
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Queries */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top User Query Types</h3>
          {!data?.topQueries || data.topQueries.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No query data available yet</p>
              <p className="text-sm text-gray-400 mt-1">Query patterns will appear as visitors interact with your chatbot</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.topQueries.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{item.query}</span>
                      <span className="text-sm text-gray-500">{item.count} queries</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage * 2}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Source Pages */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Source Pages</h3>
          {!data?.topSourcePages || data.topSourcePages.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <p className="text-gray-500">No source page data available</p>
              <p className="text-sm text-gray-400 mt-1">Source pages will appear when visitors use your chatbot</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.topSourcePages.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline truncate block"
                    >
                      {item.url}
                    </a>
                  </div>
                  <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                    {item.count} conv.
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Resolution Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolution Rate</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#2563eb"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(data?.metrics?.resolutionRate || 0) * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{data?.metrics?.resolutionRate || 0}%</span>
              </div>
            </div>
            <div>
              <p className="text-gray-600">Percentage of conversations where the bot successfully engaged with the visitor</p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Rate</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(data?.metrics?.responseRate || 0) * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{data?.metrics?.responseRate || 0}%</span>
              </div>
            </div>
            <div>
              <p className="text-gray-600">Percentage of conversations that received at least one AI response</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Lead Export History */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Export History</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Exports</p>
            <p className="text-2xl font-bold text-gray-900">{exportHistory?.totalExports || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Leads Exported</p>
            <p className="text-2xl font-bold text-gray-900">{exportHistory?.totalLeadsExported || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-600">Average per Export</p>
            <p className="text-2xl font-bold text-gray-900">
              {exportHistory?.totalExports && exportHistory.totalExports > 0
                ? Math.round(exportHistory.totalLeadsExported / exportHistory.totalExports)
                : 0}
            </p>
          </div>
        </div>

        {!exportHistory?.exports || exportHistory.exports.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">No exports yet</p>
            <p className="text-sm text-gray-400 mt-1">Export history will appear when you export leads from the Leads page</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Date & Time</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Leads Exported</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-500">Filter Applied</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.exports.map((exp) => (
                  <tr key={exp.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {new Date(exp.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-900">{exp.count}</span>
                      <span className="text-gray-500 ml-1">leads</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        exp.filter === 'hot' ? 'bg-red-100 text-red-700' :
                        exp.filter === 'warm' ? 'bg-orange-100 text-orange-700' :
                        exp.filter === 'cold' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {exp.filter === 'hot' ? '🔥 Hot' :
                         exp.filter === 'warm' ? '☀️ Warm' :
                         exp.filter === 'cold' ? '❄️ Cold' :
                         'All'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
