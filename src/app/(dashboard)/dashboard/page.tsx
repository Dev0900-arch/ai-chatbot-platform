'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import StatsCard from '@/components/dashboard/StatsCard'
import Card from '@/components/ui/Card'

interface DashboardStats {
  totalConversations: number
  conversationsLast30Days: number
  conversationChange: number
  totalLeads: number
  leadsLast30Days: number
  leadsChange: number
  totalKnowledgeArticles: number
  hotLeads: number
  warmLeads: number
  coldLeads: number
  convertedLeads: number
  totalMessages: number
  messagesLast30Days: number
  uniqueVisitors: number
  responseRate: number
}

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface RecentConversation {
  id: string
  title: string
  visitorId: string
  createdAt: string
  lastMessage: string | null
  intentScore: string | null
}

interface FullConversation {
  id: string
  title: string
  visitorId: string
  createdAt: string
  messages: Message[]
}

interface RecentLead {
  id: string
  name: string
  email: string
  status: string
  intentScore: string | null
  createdAt: string
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([])
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [selectedConversation, setSelectedConversation] = useState<FullConversation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)

  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData()
    }
  }, [user?.uid])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/dashboard/stats?userId=${user?.uid}`)

      if (!res.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await res.json()
      setStats(data.stats)
      setRecentConversations(data.recentConversations || [])
      setRecentLeads(data.recentLeads || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchConversation = async (conversationId: string) => {
    setIsLoadingConversation(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}?userId=${user?.uid}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedConversation(data.conversation)
        setIsModalOpen(true)
      }
    } catch (err) {
      console.error('Failed to fetch conversation:', err)
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  }

  const getDateGroup = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const convDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (convDate.getTime() === today.getTime()) return 'Today'
    if (convDate.getTime() === yesterday.getTime()) return 'Yesterday'

    const diffDays = Math.floor((today.getTime() - convDate.getTime()) / 86400000)
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const groupConversationsByDate = (conversations: RecentConversation[]) => {
    const groups: { [key: string]: RecentConversation[] } = {}
    conversations.forEach(conv => {
      const group = getDateGroup(conv.createdAt)
      if (!groups[group]) groups[group] = []
      groups[group].push(conv)
    })
    return groups
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const intentColors: Record<string, string> = {
    hot: 'bg-red-100 text-red-700',
    warm: 'bg-orange-100 text-orange-700',
    cold: 'bg-blue-100 text-blue-700',
    spam: 'bg-gray-100 text-gray-500',
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
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
            onClick={fetchDashboardData}
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of your chatbot platform performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => router.push('/chat')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatsCard
            title="Total Conversations"
            value={stats?.totalConversations?.toLocaleString() || '0'}
            change={stats?.conversationChange ? {
              value: Math.abs(stats.conversationChange),
              type: stats.conversationChange >= 0 ? 'increase' : 'decrease'
            } : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
        </div>
        <div onClick={() => router.push('/chat?filter=active')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatsCard
            title="Active Leads"
            value={stats?.totalLeads?.toLocaleString() || '0'}
            change={stats?.leadsChange ? {
              value: Math.abs(stats.leadsChange),
              type: stats.leadsChange >= 0 ? 'increase' : 'decrease'
            } : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        </div>
        <div onClick={() => router.push('/chat?filter=closed')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatsCard
            title="Closed Leads"
            value={stats?.convertedLeads?.toLocaleString() || '0'}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
        <div onClick={() => router.push('/analytics')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatsCard
            title="Response Rate"
            value={`${stats?.responseRate || 0}%`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Lead Intent Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={() => router.push('/leads?intentScore=hot')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <Card padding="sm" className="border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Hot Leads</p>
                <p className="text-2xl font-bold text-red-600">{stats?.hotLeads || 0}</p>
              </div>
              <span className="text-2xl">🔥</span>
            </div>
          </Card>
        </div>
        <div onClick={() => router.push('/leads?intentScore=warm')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <Card padding="sm" className="border-l-4 border-l-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Warm Leads</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.warmLeads || 0}</p>
              </div>
              <span className="text-2xl">☀️</span>
            </div>
          </Card>
        </div>
        <div onClick={() => router.push('/leads?intentScore=cold')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <Card padding="sm" className="border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cold Leads</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.coldLeads || 0}</p>
              </div>
              <span className="text-2xl">❄️</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Conversations</h3>
          {recentConversations.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-500">No conversations yet</p>
              <p className="text-sm text-gray-400">Conversations will appear here when visitors chat with your bot</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {Object.entries(groupConversationsByDate(recentConversations)).map(([dateGroup, convs]) => (
                <div key={dateGroup}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-3 first:mt-0">{dateGroup}</p>
                  {convs.map((conv) => (
                    <div key={conv.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-sm font-medium text-gray-900 truncate">{conv.title || 'Conversation'}</p>
                        {conv.lastMessage && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage.substring(0, 60)}{conv.lastMessage.length > 60 ? '...' : ''}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(conv.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {conv.intentScore && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${intentColors[conv.intentScore]}`}>
                            {conv.intentScore.charAt(0).toUpperCase() + conv.intentScore.slice(1)}
                          </span>
                        )}
                        <button
                          onClick={() => fetchConversation(conv.id)}
                          disabled={isLoadingConversation}
                          className="px-3 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Leads</h3>
          {recentLeads.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500">No leads yet</p>
              <p className="text-sm text-gray-400">Leads will appear here when visitors interact with your chatbot</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                  </div>
                  {lead.intentScore ? (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${intentColors[lead.intentScore]}`}>
                      {lead.intentScore.charAt(0).toUpperCase() + lead.intentScore.slice(1)}
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      New
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Conversation Modal */}
      {isModalOpen && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-primary-600 text-white p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">{selectedConversation.title || 'Conversation'}</h3>
                  <p className="text-xs text-white/80">
                    {new Date(selectedConversation.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-gray-100">
              {selectedConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                        : 'bg-primary-600 text-white rounded-br-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-gray-400' : 'text-white/70'}`}>
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-white flex-shrink-0">
              <p className="text-xs text-gray-400 text-center">
                {selectedConversation.messages.length} messages in this conversation
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
