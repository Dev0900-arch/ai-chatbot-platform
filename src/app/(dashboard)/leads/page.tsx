'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  status: string
  intentScore?: string
  conversationSummary?: string
  aiRecommendation?: string
  source?: string
  sourcePageUrl?: string
  createdAt: string
}

export default function LeadsPage() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', intentScore: '', search: '' })
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (user?.uid) {
      fetchLeads()
    }
  }, [user?.uid])

  const fetchLeads = async () => {
    if (!user?.uid) return

    try {
      const res = await fetch(`/api/leads?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || [])
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-purple-100 text-purple-700',
    converted: 'bg-green-100 text-green-700',
    lost: 'bg-gray-100 text-gray-700',
  }

  const intentColors: Record<string, string> = {
    hot: 'bg-red-100 text-red-700 border border-red-300',
    warm: 'bg-orange-100 text-orange-700 border border-orange-300',
    cold: 'bg-blue-100 text-blue-700 border border-blue-300',
    spam: 'bg-gray-100 text-gray-500 border border-gray-300',
  }

  const intentIcons: Record<string, string> = {
    hot: '🔥',
    warm: '☀️',
    cold: '❄️',
    spam: '🚫',
  }

  const filteredLeads = leads.filter(lead => {
    if (filter.status && lead.status !== filter.status) return false
    if (filter.intentScore && lead.intentScore !== filter.intentScore) return false
    if (filter.search) {
      const search = filter.search.toLowerCase()
      return lead.name.toLowerCase().includes(search) ||
        lead.email.toLowerCase().includes(search)
    }
    return true
  })

  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.intentScore === 'hot').length,
    warm: leads.filter(l => l.intentScore === 'warm').length,
    cold: leads.filter(l => l.intentScore === 'cold').length,
  }

  const exportLeadsToCSV = async () => {
    if (filteredLeads.length === 0) return

    const headers = ['Name', 'Email', 'Phone', 'Intent Score', 'Status', 'Conversation Summary', 'AI Recommendation', 'Source Page', 'Date']
    const rows = filteredLeads.map(lead => [
      lead.name,
      lead.email,
      lead.phone || '',
      lead.intentScore || '',
      lead.status,
      lead.conversationSummary?.replace(/"/g, '""') || '',
      lead.aiRecommendation?.replace(/"/g, '""') || '',
      lead.sourcePageUrl || '',
      new Date(lead.createdAt).toLocaleDateString()
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Track export in database
    if (user?.uid) {
      try {
        await fetch('/api/leads/track-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            leadCount: filteredLeads.length,
            filterApplied: filter.intentScore || 'all'
          })
        })
      } catch (error) {
        console.error('Failed to track export:', error)
      }
    }
  }

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    if (!user?.uid) return

    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, userId: user.uid, status: newStatus })
      })
      if (res.ok) {
        setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
        if (selectedLead?.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus })
        }
      }
    } catch (error) {
      console.error('Failed to update lead:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <p className="text-gray-600 mt-1">AI-qualified leads from your chatbot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportLeadsToCSV} disabled={filteredLeads.length === 0}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Button>
          <Button onClick={fetchLeads}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats with Intent Scoring */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-600">Total Leads</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-red-500">
          <p className="text-sm text-gray-600 flex items-center">
            <span className="mr-1">🔥</span> Hot Leads
          </p>
          <p className="text-2xl font-bold text-red-600">{stats.hot}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-orange-500">
          <p className="text-sm text-gray-600 flex items-center">
            <span className="mr-1">☀️</span> Warm Leads
          </p>
          <p className="text-2xl font-bold text-orange-600">{stats.warm}</p>
        </Card>
        <Card padding="sm" className="border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-600 flex items-center">
            <span className="mr-1">❄️</span> Cold Leads
          </p>
          <p className="text-2xl font-bold text-blue-600">{stats.cold}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search leads..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <select
            value={filter.intentScore}
            onChange={(e) => setFilter({ ...filter, intentScore: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Intent Scores</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">☀️ Warm</option>
            <option value="cold">❄️ Cold</option>
            <option value="spam">🚫 Spam</option>
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads Table */}
        <div className="lg:col-span-2">
          <Card padding="none">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-600">No leads yet</p>
                <p className="text-sm text-gray-500 mt-1">Leads will appear here when visitors interact with your chatbot</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedLead?.id === lead.id ? 'bg-primary-50' : ''}`}
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-primary-700">
                                {lead.name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-3 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                              <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {lead.intentScore ? (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${intentColors[lead.intentScore]}`}>
                              {intentIcons[lead.intentScore]} {lead.intentScore.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[lead.status]}`}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLead(lead) }}
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Lead Detail Panel */}
        <div className="lg:col-span-1">
          <Card>
            {selectedLead ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Lead Details</h3>
                  {selectedLead.intentScore && (
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${intentColors[selectedLead.intentScore]}`}>
                      {intentIcons[selectedLead.intentScore]} {selectedLead.intentScore.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Name</p>
                    <p className="text-sm font-medium">{selectedLead.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Email</p>
                    <p className="text-sm">{selectedLead.email}</p>
                  </div>
                  {selectedLead.phone && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Phone</p>
                      <p className="text-sm">{selectedLead.phone}</p>
                    </div>
                  )}
                  {selectedLead.sourcePageUrl && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Source Page</p>
                      <a href={selectedLead.sourcePageUrl} target="_blank" className="text-sm text-primary-600 hover:underline truncate block">
                        {selectedLead.sourcePageUrl}
                      </a>
                    </div>
                  )}
                </div>

                {selectedLead.conversationSummary && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Conversation Summary</p>
                    <p className="text-sm text-gray-700">{selectedLead.conversationSummary}</p>
                  </div>
                )}

                {selectedLead.aiRecommendation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700 uppercase mb-1 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI Recommendation
                    </p>
                    <p className="text-sm text-amber-800">{selectedLead.aiRecommendation}</p>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 uppercase mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {['new', 'contacted', 'qualified', 'converted', 'lost'].map(status => (
                      <button
                        key={status}
                        onClick={() => updateLeadStatus(selectedLead.id, status)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          selectedLead.status === status
                            ? statusColors[status]
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-gray-500">Select a lead to view details</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
