'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Card from '@/components/ui/Card'

type FilterType = 'all' | 'active' | 'closed'

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface Lead {
  id: string
  name: string
  email: string
  intentScore: string | null
}

interface Conversation {
  id: string
  visitorId: string | null
  title: string | null
  visitorEmail: string | null
  sourcePageUrl: string | null
  isClosed: boolean
  createdAt: string
  updatedAt: string
  messages: Message[]
  lead: Lead | null
}

export default function ChatPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get filter from URL params, default to 'all'
  const filterParam = searchParams.get('filter') as FilterType | null
  const activeFilter: FilterType = filterParam && ['all', 'active', 'closed'].includes(filterParam) ? filterParam : 'all'

  const setFilter = (filter: FilterType) => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', filter)
    }
    router.push(`/chat${params.toString() ? '?' + params.toString() : ''}`)
  }

  useEffect(() => {
    if (user?.uid) {
      fetchConversations()
    }
  }, [user?.uid])

  useEffect(() => {
    scrollToBottom()
  }, [selectedConversation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversations = async () => {
    if (!user?.uid) return

    try {
      const res = await fetch(`/api/conversations?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
        // Auto-select first conversation if none selected
        if (data.conversations?.length > 0 && !selectedConversation) {
          setSelectedConversation(data.conversations[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const intentColors: Record<string, string> = {
    hot: 'bg-red-100 text-red-700',
    warm: 'bg-orange-100 text-orange-700',
    cold: 'bg-blue-100 text-blue-700',
    spam: 'bg-gray-100 text-gray-500',
  }

  const intentIcons: Record<string, string> = {
    hot: '🔥',
    warm: '☀️',
    cold: '❄️',
    spam: '🚫',
  }

  // Check if conversation is active (within last 24 hours)
  const isConversationActive = (conv: Conversation) => {
    // Truly real-time: widget not closed AND visitor sent a message in the last 5 minutes
    if (conv.isClosed) return false
    const lastMessage = conv.messages[conv.messages.length - 1]
    const lastActivity = lastMessage ? new Date(lastMessage.createdAt) : new Date(conv.updatedAt)
    const minutesDiff = (Date.now() - lastActivity.getTime()) / (1000 * 60)
    return minutesDiff <= 5
  }

  const filteredConversations = conversations.filter(conv => {
    // First apply the active/closed filter
    if (activeFilter === 'active' && !isConversationActive(conv)) return false
    if (activeFilter === 'closed' && isConversationActive(conv)) return false

    // Then apply search filter
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      conv.title?.toLowerCase().includes(search) ||
      conv.visitorEmail?.toLowerCase().includes(search) ||
      conv.lead?.name?.toLowerCase().includes(search) ||
      conv.lead?.email?.toLowerCase().includes(search) ||
      conv.messages.some(m => m.content.toLowerCase().includes(search))
    )
  })

  // Get counts for each filter
  const allCount = conversations.length
  const activeCount = conversations.filter(isConversationActive).length
  const closedCount = conversations.filter(conv => !isConversationActive(conv)).length

  const getConversationPreview = (conv: Conversation) => {
    const lastMessage = conv.messages[conv.messages.length - 1]
    if (lastMessage) {
      return lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')
    }
    return 'No messages'
  }

  const getConversationTitle = (conv: Conversation) => {
    if (conv.lead?.name && conv.lead.name !== 'Website Visitor') {
      return conv.lead.name
    }
    if (conv.visitorEmail) {
      return conv.visitorEmail
    }
    return conv.title || `Visitor ${conv.visitorId?.substring(0, 8) || 'Unknown'}`
  }

  const formatTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return d.toLocaleDateString([], { weekday: 'short' })
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Chat Inbox</h2>
          <p className="text-gray-600 mt-1">View conversations from your chatbot</p>
        </div>
        <button
          onClick={fetchConversations}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Conversations Sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          {/* Filter Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              All
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === 'all' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {allCount}
              </span>
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                activeFilter === 'active'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Active
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {activeCount}
              </span>
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                activeFilter === 'closed'
                  ? 'text-gray-700 border-b-2 border-gray-600 bg-gray-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Closed
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === 'closed' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {closedCount}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-500 text-sm">
                  {activeFilter === 'all' && 'No conversations yet'}
                  {activeFilter === 'active' && 'No active conversations'}
                  {activeFilter === 'closed' && 'No closed conversations'}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {activeFilter === 'all' && 'Conversations will appear when visitors use your chatbot'}
                  {activeFilter === 'active' && 'Active conversations are visitors currently chatting (message in last 5 min)'}
                  {activeFilter === 'closed' && 'Closed conversations are those the visitor has ended or gone quiet on'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary-50 border-l-4 border-l-primary-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-gray-600">
                          {getConversationTitle(conv).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getConversationTitle(conv)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTime(conv.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 ml-10">
                    <p className="text-xs text-gray-500 truncate flex-1">
                      {getConversationPreview(conv)}
                    </p>
                    {conv.lead?.intentScore && (
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${intentColors[conv.lead.intentScore]}`}>
                        {intentIcons[conv.lead.intentScore]}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {getConversationTitle(selectedConversation).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {getConversationTitle(selectedConversation)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedConversation.messages.length} messages
                      {selectedConversation.sourcePageUrl && (
                        <span> • from {new URL(selectedConversation.sourcePageUrl).hostname}</span>
                      )}
                    </p>
                  </div>
                </div>
                {selectedConversation.lead?.intentScore && (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${intentColors[selectedConversation.lead.intentScore]}`}>
                    {intentIcons[selectedConversation.lead.intentScore]} {selectedConversation.lead.intentScore.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                          : 'bg-primary-600 text-white rounded-br-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-gray-400' : 'text-primary-200'}`}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Lead Info Footer */}
              {selectedConversation.lead && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-xs text-gray-500">Lead Info</p>
                        <p className="text-sm font-medium">{selectedConversation.lead.email}</p>
                      </div>
                    </div>
                    <a
                      href="/leads"
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View in Leads →
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-500">Select a conversation to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
