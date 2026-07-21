'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import usePaddle from '@/lib/usePaddle'

interface KnowledgeItem {
  id: string
  title: string
  category: string | null
  sourceType: string
  sourceUrl: string | null
  fileName: string | null
  createdAt: string
  updatedAt: string
}

type TabType = 'chatbot' | 'knowledge' | 'crm' | 'billing'

export default function SettingsPage() {
  const { user } = useAuth()
  const paddle = usePaddle()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('chatbot')

  useEffect(() => {
    if (searchParams.get('tab') === 'billing') {
      setActiveTab('billing')
    }
  }, [searchParams])

  // Billing State
  const [subscriptionType, setSubscriptionType] = useState('trial')
  const [subscriptionStatus, setSubscriptionStatus] = useState('active')
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null)
  const [isLifetimeFree, setIsLifetimeFree] = useState(false)
  const [paddlePriceId, setPaddlePriceId] = useState<string | null>(null)
  const [isLoadingBilling, setIsLoadingBilling] = useState(true)

  // Chatbot Widget State
  const [botName, setBotName] = useState('AI Assistant')
  const [businessName, setBusinessName] = useState('')
  const [registeredDomain, setRegisteredDomain] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! How can I help you today?')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')
  const [aiModel, setAiModel] = useState('openai/gpt-3.5-turbo')
  const [leadFormEnabled, setLeadFormEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(true)
  const [chatbotMessage, setChatbotMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Preview State
  const [previewOpen, setPreviewOpen] = useState(true)
  const [previewMessages, setPreviewMessages] = useState<{role: string, content: string}[]>([])
  const [previewInput, setPreviewInput] = useState('')

  // Initialize preview messages when welcome message changes
  useEffect(() => {
    setPreviewMessages([{ role: 'assistant', content: welcomeMessage || 'Hello! How can I help you today?' }])
  }, [welcomeMessage])

  // Knowledge Base State
  const [articles, setArticles] = useState<KnowledgeItem[]>([])
  const [isLoadingKB, setIsLoadingKB] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapeCategory, setScrapeCategory] = useState('')
  const [kbMessage, setKbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CRM Integration State
  const [crmIntegrations, setCrmIntegrations] = useState<any[]>([])
  const [isLoadingCRM, setIsLoadingCRM] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [crmCredentials, setCrmCredentials] = useState<Record<string, string>>({})
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [crmMessage, setCrmMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  // Load user settings on mount
  useEffect(() => {
    if (user?.uid) {
      loadUserSettings()
      fetchArticles()
      fetchCRMIntegrations()
    }
  }, [user?.uid])

  const loadUserSettings = async () => {
    try {
      setIsLoadingChatbot(true)
      const res = await fetch(`/api/user?firebaseUid=${user?.uid}`)
      if (res.ok) {
        const data = await res.json()
        if (data.botName) setBotName(data.botName)
        if (data.businessName) setBusinessName(data.businessName)
        if (data.registeredDomain) setRegisteredDomain(data.registeredDomain)
        if (data.welcomeMessage) setWelcomeMessage(data.welcomeMessage)
        if (data.primaryColor) setPrimaryColor(data.primaryColor)
        if (data.aiModel) setAiModel(data.aiModel)
        if (typeof data.leadFormEnabled === 'boolean') setLeadFormEnabled(data.leadFormEnabled)
        if (data.subscriptionType) setSubscriptionType(data.subscriptionType)
        if (data.subscriptionStatus) setSubscriptionStatus(data.subscriptionStatus)
        setSubscriptionEndsAt(data.subscriptionEndsAt || null)
        setIsLifetimeFree(!!data.isLifetimeFree)
        setPaddlePriceId(data.paddlePriceId || null)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setIsLoadingChatbot(false)
      setIsLoadingBilling(false)
    }
  }

  // Fetch knowledge base items
  const fetchArticles = async () => {
    if (!user?.uid) return
    setIsLoadingKB(true)
    try {
      const res = await fetch(`/api/knowledge-base?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    } finally {
      setIsLoadingKB(false)
    }
  }

  // Generate embed code using real Firebase UID
  const embedCode = user?.uid ? `<!-- AI Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${appUrl}/widget.js?v=${Date.now()}';
    script.async = true;
    script.onload = function() {
      window.ChatBotWidget.init({
        userId: '${user.uid}',
        primaryColor: '${primaryColor}',
        welcomeMessage: '${welcomeMessage.replace(/'/g, "\\'")}',
        botName: '${botName.replace(/'/g, "\\'")}',
        model: '${aiModel}'
      });
    };
    document.head.appendChild(script);
  })();
</script>` : '<!-- Loading... Sign in to get your embed code -->'

  const handleSave = async () => {
    if (!user?.uid) {
      setChatbotMessage({ type: 'error', text: 'You must be signed in to save settings' })
      return
    }

    setIsSaving(true)
    setChatbotMessage(null)

    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: user.uid,
          botName,
          businessName,
          registeredDomain: registeredDomain || null,
          welcomeMessage,
          primaryColor,
          aiModel,
          leadFormEnabled,
        }),
      })

      if (res.ok) {
        setChatbotMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        const data = await res.json()
        setChatbotMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch {
      setChatbotMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const openBillingCheckout = (priceId: string) => {
    if (!paddle || !user || !user.email) return
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: user.uid },
      settings: { successUrl: `${window.location.origin}/settings?tab=billing&upgraded=true` },
    })
  }

  const copyEmbedCode = () => {
    if (!user?.uid) {
      setChatbotMessage({ type: 'error', text: 'You must be signed in to copy embed code' })
      return
    }
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Preview interaction handlers
  const handlePreviewSend = () => {
    if (!previewInput.trim()) return

    // Add user message
    const newMessages = [...previewMessages, { role: 'user', content: previewInput }]
    setPreviewMessages(newMessages)
    setPreviewInput('')

    // Simulate AI response after a short delay
    setTimeout(() => {
      setPreviewMessages(prev => [...prev, {
        role: 'assistant',
        content: `This is a preview response from ${botName || 'AI Assistant'}. In the live widget, this would be a real AI response based on your knowledge base.`
      }])
    }, 800)
  }

  const handlePreviewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePreviewSend()
    }
  }

  const resetPreview = () => {
    setPreviewMessages([{ role: 'assistant', content: welcomeMessage || 'Hello! How can I help you today?' }])
    setPreviewOpen(true)
  }

  // Handle URL scraping
  const handleScrapeUrl = async () => {
    if (!user?.uid) {
      setKbMessage({ type: 'error', text: 'You must be signed in to scrape URLs' })
      return
    }

    if (!scrapeUrl) {
      setKbMessage({ type: 'error', text: 'Please enter a URL to scrape' })
      return
    }

    setIsScraping(true)
    setKbMessage(null)

    try {
      const res = await fetch('/api/knowledge-base/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scrapeUrl,
          userId: user.uid,
          category: scrapeCategory || 'Website Content',
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setKbMessage({
          type: 'success',
          text: `Successfully scraped! Found ${data.stats.headingsFound} headings, ${data.stats.paragraphsFound} paragraphs.`,
        })
        setScrapeUrl('')
        setScrapeCategory('')
        fetchArticles()
      } else {
        setKbMessage({ type: 'error', text: data.error || 'Failed to scrape URL' })
      }
    } catch {
      setKbMessage({ type: 'error', text: 'Failed to scrape URL. Please check the URL and try again.' })
    } finally {
      setIsScraping(false)
    }
  }

  // Process files
  const processFiles = async (files: FileList | File[]) => {
    if (!user?.uid) {
      setKbMessage({ type: 'error', text: 'You must be signed in to upload files' })
      return
    }

    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setIsUploading(true)
    setKbMessage(null)

    let successCount = 0
    let errorCount = 0

    for (const file of fileArray) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', user.uid)
      formData.append('category', 'Uploaded Document')

      try {
        const res = await fetch('/api/knowledge-base/upload', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    setIsUploading(false)

    if (successCount > 0) {
      setKbMessage({
        type: 'success',
        text: `Successfully uploaded ${successCount} file(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
      })
      fetchArticles()
    } else {
      setKbMessage({ type: 'error', text: 'Failed to upload files. Please try again.' })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await processFiles(files)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user?.uid) {
      setKbMessage({ type: 'error', text: 'You must be signed in to delete items' })
      return
    }

    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const res = await fetch(`/api/knowledge-base?id=${id}&userId=${user.uid}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setKbMessage({ type: 'success', text: 'Item deleted successfully' })
        fetchArticles()
      } else {
        setKbMessage({ type: 'error', text: 'Failed to delete item' })
      }
    } catch {
      setKbMessage({ type: 'error', text: 'Failed to delete item' })
    }
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'url_scrape':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        )
      case 'document_upload':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
    }
  }

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'url_scrape':
        return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">Web Scrape</span>
      case 'document_upload':
        return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">Document</span>
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">Manual</span>
    }
  }

  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !filterCategory || article.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))]

  // CRM Integration functions
  const fetchCRMIntegrations = async () => {
    if (!user?.uid) return
    setIsLoadingCRM(true)
    try {
      const res = await fetch(`/api/crm/connect?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        setCrmIntegrations(data.integrations || [])
      }
    } catch (error) {
      console.error('Failed to fetch CRM integrations:', error)
    } finally {
      setIsLoadingCRM(false)
    }
  }

  const handleConnectCRM = async () => {
    if (!selectedPlatform || !user?.uid) return
    setIsConnecting(true)
    setCrmMessage(null)

    try {
      const res = await fetch('/api/crm/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          platform: selectedPlatform,
          ...crmCredentials
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setCrmMessage({ type: 'success', text: `Successfully connected to ${selectedPlatform}!` })
        setSelectedPlatform(null)
        setCrmCredentials({})
        fetchCRMIntegrations()
      } else {
        const errorDetail = data.details ? `\n${data.details}` : ''
        setCrmMessage({ type: 'error', text: `${data.error || 'Failed to connect to CRM'}${errorDetail}` })
      }
    } catch (error) {
      setCrmMessage({ type: 'error', text: 'Connection error. Please check your network and try again.' })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnectCRM = async (platform: string) => {
    if (!user?.uid) return
    if (!confirm(`Disconnect from ${platform}? This will stop automatic syncing.`)) return

    try {
      const res = await fetch(`/api/crm/disconnect?userId=${user.uid}&platform=${platform}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setCrmMessage({ type: 'success', text: `Disconnected from ${platform}` })
        fetchCRMIntegrations()
      } else {
        const data = await res.json()
        setCrmMessage({ type: 'error', text: data.error || 'Failed to disconnect' })
      }
    } catch (error) {
      setCrmMessage({ type: 'error', text: 'Failed to disconnect from CRM' })
    }
  }

  const handleToggleAutoSync = async (platform: string, currentValue: boolean) => {
    if (!user?.uid) return

    try {
      const res = await fetch('/api/crm/disconnect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          platform,
          autoSync: !currentValue
        })
      })

      if (res.ok) {
        setCrmMessage({ type: 'success', text: `Auto-sync ${!currentValue ? 'enabled' : 'disabled'} for ${platform}` })
        fetchCRMIntegrations()
      } else {
        const data = await res.json()
        setCrmMessage({ type: 'error', text: data.error || 'Failed to update auto-sync' })
      }
    } catch (error) {
      setCrmMessage({ type: 'error', text: 'Failed to update auto-sync' })
    }
  }

  const handleSyncAll = async (platform?: string) => {
    if (!user?.uid) return
    setIsSyncing(true)
    setCrmMessage(null)

    try {
      const res = await fetch('/api/crm/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          ...(platform && { platform })
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        const successCount = data.results?.reduce((sum: number, r: any) => sum + r.success, 0) || 0
        setCrmMessage({ type: 'success', text: `Successfully synced ${successCount} leads to CRM` })
        fetchCRMIntegrations()
      } else {
        setCrmMessage({ type: 'error', text: data.error || 'Failed to sync leads' })
      }
    } catch (error) {
      setCrmMessage({ type: 'error', text: 'Failed to sync leads' })
    } finally {
      setIsSyncing(false)
    }
  }

  const crmPlatforms = [
    { id: 'hubspot', name: 'HubSpot', fields: ['accessToken'] },
    { id: 'salesforce', name: 'Salesforce', fields: ['accessToken', 'domain'] },
    { id: 'pipedrive', name: 'Pipedrive', fields: ['apiKey'] },
    { id: 'close', name: 'Close', fields: ['apiKey'] },
    { id: 'zoho', name: 'Zoho CRM', fields: ['accessToken', 'domain'] },
    { id: 'instantly', name: 'Instantly', fields: ['apiKey'] }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-1">Configure your chatbot and knowledge base</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('chatbot')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'chatbot'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Chatbot Widget
            </span>
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'knowledge'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Knowledge Base
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{articles.length}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'crm'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              CRM Integration
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{crmIntegrations.filter(i => i.isActive).length}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'billing'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Billing
            </span>
          </button>
        </nav>
      </div>

      {/* Chatbot Widget Tab */}
      {activeTab === 'chatbot' && (
        <div className="space-y-6">
          {/* User ID Info */}
          {user?.uid && (
            <Card padding="sm" className="bg-blue-50 border-blue-200">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-blue-800">
                    <strong>Your User ID:</strong> <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{user.uid}</code>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">This ID uniquely identifies your chatbot.</p>
                </div>
              </div>
            </Card>
          )}

          {/* Status Message */}
          {chatbotMessage && (
            <div className={`p-4 rounded-lg ${chatbotMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${chatbotMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {chatbotMessage.text}
              </p>
            </div>
          )}

          {isLoadingChatbot ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading settings...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration */}
              <div className="space-y-6">
                {/* Bot Identity */}
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Bot Identity</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bot Name</label>
                      <Input placeholder="AI Assistant" value={botName} onChange={(e) => setBotName(e.target.value)} />
                      <p className="text-xs text-gray-500 mt-1">Displayed in the widget header</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                      <Input placeholder="My Business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                      <p className="text-xs text-gray-500 mt-1">Used in AI responses for context</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Registered Domain</label>
                      <Input placeholder="example.com" value={registeredDomain} onChange={(e) => setRegisteredDomain(e.target.value)} />
                      <p className="text-xs text-gray-500 mt-1">Widget only works on this domain (leave empty for any)</p>
                    </div>
                  </div>
                </Card>

                {/* Widget Appearance */}
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Widget Appearance</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Lead Capture Form</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Chat shuru honay se pehle visitor se naam/email/phone maango
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={leadFormEnabled}
                        onClick={() => setLeadFormEnabled(!leadFormEnabled)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                          leadFormEnabled ? 'bg-primary-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            leadFormEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                      <textarea
                        rows={3}
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Hello! How can I help you today?"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Fast & Affordable)</option>
                        <option value="openai/gpt-4-turbo">GPT-4 Turbo (Most Capable)</option>
                        <option value="anthropic/claude-3-haiku">Claude 3 Haiku (Fast)</option>
                        <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet (Balanced)</option>
                      </select>
                    </div>
                    <Button className="w-full" onClick={handleSave} isLoading={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Live Preview */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Interactive Preview</h3>
                    <p className="text-sm text-gray-500">Test your widget - type messages and see real-time updates</p>
                  </div>
                  <button
                    onClick={resetPreview}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Reset Preview
                  </button>
                </div>
                <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg p-4 min-h-[520px] flex items-end justify-end relative">
                  {/* Simulated website background */}
                  <div className="absolute inset-4 bg-white rounded-lg shadow-sm p-4 overflow-hidden">
                    <div className="h-4 w-32 bg-gray-200 rounded mb-3"></div>
                    <div className="h-3 w-full bg-gray-100 rounded mb-2"></div>
                    <div className="h-3 w-3/4 bg-gray-100 rounded mb-2"></div>
                    <div className="h-3 w-5/6 bg-gray-100 rounded mb-4"></div>
                    <div className="h-20 w-full bg-gray-50 rounded mb-3"></div>
                    <div className="h-3 w-2/3 bg-gray-100 rounded"></div>
                  </div>

                  {/* Chat Widget Preview */}
                  {previewOpen ? (
                    <div className="relative z-10 w-80">
                      <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm">{botName || 'AI Assistant'}</p>
                              <p className="text-xs text-white/80">Online</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setPreviewOpen(false)}
                            className="text-white/80 hover:text-white transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Messages */}
                        <div className="p-4 h-52 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                          {previewMessages.map((msg, idx) => (
                            <div key={idx} className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`rounded-lg px-3 py-2 max-w-[80%] ${
                                  msg.role === 'user'
                                    ? 'text-white rounded-br-sm'
                                    : 'bg-white shadow-sm border border-gray-100 text-gray-800 rounded-bl-sm'
                                }`}
                                style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                              >
                                <p className="text-sm">{msg.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-gray-200 bg-white">
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Type a test message..."
                              value={previewInput}
                              onChange={(e) => setPreviewInput(e.target.value)}
                              onKeyDown={handlePreviewKeyDown}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                            <button
                              onClick={handlePreviewSend}
                              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Chat Button when closed */
                    <button
                      onClick={() => setPreviewOpen(true)}
                      className="relative z-10 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Embed Code */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Embed Code</h3>
              <Button variant="outline" size="sm" onClick={copyEmbedCode} disabled={!user?.uid}>
                {copied ? 'Copied!' : 'Copy Code'}
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Copy and paste this code before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag on your website.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                <code>{embedCode}</code>
              </pre>
            </div>
          </Card>

          {/* Testing Link */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Your Widget</h3>
            <p className="text-sm text-gray-600 mb-4">Try your chatbot on our demo page.</p>
            {user?.uid ? (
              <a
                href={`/demo.html?userId=${user.uid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                Open Demo Page
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <p className="text-sm text-gray-500">Sign in to test your widget</p>
            )}
          </Card>
        </div>
      )}

      {/* Knowledge Base Tab */}
      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          {/* Status Message */}
          {kbMessage && (
            <div className={`p-4 rounded-lg ${kbMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${kbMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {kbMessage.text}
              </p>
            </div>
          )}

          {/* URL Scraping Section */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Import from Website URL
              </span>
            </h3>
            <p className="text-sm text-gray-600 mb-4">Scrape content from any public website to train your chatbot.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input placeholder="https://example.com/about" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} disabled={isScraping} />
              </div>
              <div className="w-full sm:w-48">
                <Input placeholder="Category (optional)" value={scrapeCategory} onChange={(e) => setScrapeCategory(e.target.value)} disabled={isScraping} />
              </div>
              <Button onClick={handleScrapeUrl} disabled={isScraping} isLoading={isScraping}>
                {isScraping ? 'Scraping...' : 'Scrape URL'}
              </Button>
            </div>
          </Card>

          {/* Document Upload Section */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Documents
              </span>
            </h3>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploading && e.dataTransfer.files.length > 0) {
                  processFiles(e.dataTransfer.files);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                  <p className="text-gray-600">Uploading and processing files...</p>
                </div>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                  <p className="text-sm text-gray-500">Supports PDF, TXT, DOCX, and MD files</p>
                </>
              )}
            </div>
          </Card>

          {/* Search and Filter */}
          <Card>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search knowledge base..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat!}>{cat}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* Articles List */}
          <Card padding="none">
            {isLoadingKB ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading knowledge base...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No knowledge base items yet</p>
                <p className="text-sm text-gray-400 mt-1">Scrape a URL or upload documents to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredArticles.map((article) => (
                  <div key={article.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          {getSourceIcon(article.sourceType)}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{article.title}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            {getSourceBadge(article.sourceType)}
                            {article.category && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                {article.category}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(article.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(article.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* CRM Integration Tab */}
      {activeTab === 'crm' && (
        <div className="space-y-6">
          {/* Status Message */}
          {crmMessage && (
            <div className={`p-4 rounded-lg ${crmMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${crmMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {crmMessage.text}
              </p>
            </div>
          )}

          {/* Info Banner */}
          <Card padding="sm" className="bg-blue-50 border-blue-200">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">CRM Integration</h4>
                <p className="text-xs text-blue-700">
                  Connect your favorite CRM platforms to automatically sync leads captured by your chatbot. Enable auto-sync to automatically push new leads as they come in.
                </p>
              </div>
            </div>
          </Card>

          {/* Connected CRM Platforms */}
          {!isLoadingCRM && crmIntegrations.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Platforms</h3>
              <div className="space-y-3">
                {crmIntegrations.map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${integration.syncStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <h4 className="font-medium text-gray-900 capitalize">{integration.platform}</h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          integration.syncStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {integration.syncStatus}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        {integration.lastSyncAt && (
                          <span>Last synced: {new Date(integration.lastSyncAt).toLocaleString()}</span>
                        )}
                        {integration.domain && <span>Domain: {integration.domain}</span>}
                      </div>
                      {integration.syncError && (
                        <p className="text-xs text-red-600 mt-1">{integration.syncError}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={integration.autoSync}
                          onChange={() => handleToggleAutoSync(integration.platform, integration.autoSync)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">Auto-sync</span>
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncAll(integration.platform)}
                        disabled={isSyncing}
                      >
                        Sync All
                      </Button>
                      <button
                        onClick={() => handleDisconnectCRM(integration.platform)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                        title="Disconnect"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Available CRM Platforms */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available CRM Platforms</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {crmPlatforms.map((platform) => {
                const isConnected = crmIntegrations.some(i => i.platform === platform.id && i.isActive)
                return (
                  <button
                    key={platform.id}
                    onClick={() => !isConnected && setSelectedPlatform(platform.id)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedPlatform === platform.id
                        ? 'border-primary-500 bg-primary-50'
                        : isConnected
                        ? 'border-green-300 bg-green-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                    }`}
                    disabled={isConnected}
                  >
                    <h4 className="font-medium text-gray-900">{platform.name}</h4>
                    {isConnected && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Connected
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Connection Form */}
          {selectedPlatform && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Connect to {crmPlatforms.find(p => p.id === selectedPlatform)?.name}
              </h3>
              <div className="space-y-4">
                {crmPlatforms.find(p => p.id === selectedPlatform)?.fields.map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                      {field === 'accessToken' ? 'Access Token' : field === 'apiKey' ? 'API Key' : field}
                    </label>
                    <Input
                      type={field.includes('Token') || field.includes('Key') || field.includes('Secret') ? 'password' : 'text'}
                      placeholder={
                        field === 'accessToken' ? 'Enter your access token' :
                        field === 'apiKey' ? 'Enter your API key' :
                        field === 'domain' ? 'e.g., mycompany.salesforce.com' :
                        `Enter ${field}`
                      }
                      value={crmCredentials[field] || ''}
                      onChange={(e) => setCrmCredentials({ ...crmCredentials, [field]: e.target.value })}
                    />
                  </div>
                ))}
                <div>
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={crmCredentials.autoSync === 'true'}
                      onChange={(e) => setCrmCredentials({ ...crmCredentials, autoSync: e.target.checked ? 'true' : 'false' })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">Enable auto-sync for new leads</span>
                  </label>
                </div>
                <div className="flex space-x-3">
                  <Button onClick={handleConnectCRM} isLoading={isConnecting} disabled={isConnecting}>
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedPlatform(null); setCrmCredentials({}) }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Bulk Sync All Leads */}
          {crmIntegrations.some(i => i.isActive) && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk Sync</h3>
              <p className="text-sm text-gray-600 mb-4">
                Sync all existing leads to your connected CRM platforms at once.
              </p>
              <Button onClick={() => handleSyncAll()} isLoading={isSyncing} disabled={isSyncing}>
                {isSyncing ? 'Syncing...' : 'Sync All Leads to All Connected CRMs'}
              </Button>
            </Card>
          )}

          {isLoadingCRM && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading CRM integrations...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {isLoadingBilling ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading billing info...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Current Plan */}
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h3>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 capitalize">
                      {isLifetimeFree
                        ? 'Lifetime Free'
                        : paddlePriceId && paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY
                        ? 'Yearly Plan'
                        : paddlePriceId && paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY
                        ? 'Monthly Plan'
                        : subscriptionType === 'trial'
                        ? 'Free Trial'
                        : subscriptionType}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Status:{' '}
                      <span
                        className={`font-medium ${
                          subscriptionStatus === 'active' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {subscriptionStatus}
                      </span>
                      {subscriptionEndsAt && (
                        <>
                          {' '}
                          &middot;{' '}
                          {subscriptionType === 'trial' ? 'Trial ends' : 'Renews'}{' '}
                          {new Date(subscriptionEndsAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {!isLifetimeFree && subscriptionStatus === 'active' && subscriptionType === 'paid' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                      &#10003; Active
                    </span>
                  )}
                </div>
              </Card>

              {/* Upgrade Options */}
              {!isLifetimeFree && (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {subscriptionType === 'paid' && subscriptionStatus === 'active'
                      ? 'Change Plan'
                      : 'Upgrade Your Plan'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {subscriptionType === 'trial'
                      ? 'Trial se paid plan me upgrade karo — koi interruption nahi.'
                      : subscriptionStatus !== 'active'
                      ? 'Apna subscription renew karo aur Uplync use karna jaari rakho.'
                      : paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY
                      ? 'Aap already sabse best value plan (Yearly) pe hain.'
                      : 'Yearly plan pe switch kar k paisay bachao.'}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Monthly */}
                    <div
                      className={`border rounded-lg p-4 ${
                        paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Monthly</p>
                      <p className="text-sm text-gray-500 mb-3">Billed every month</p>
                      {paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY &&
                      subscriptionStatus === 'active' ? (
                        <span className="text-sm font-medium text-primary-600">Current Plan</span>
                      ) : (
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => openBillingCheckout(process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY!)}
                        >
                          {subscriptionType === 'paid' ? 'Switch to Monthly' : 'Choose Monthly'}
                        </Button>
                      )}
                    </div>

                    {/* Yearly */}
                    <div
                      className={`border rounded-lg p-4 ${
                        paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">
                        Yearly <span className="text-xs text-green-600 font-medium">Best Value</span>
                      </p>
                      <p className="text-sm text-gray-500 mb-3">Billed once a year</p>
                      {paddlePriceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY &&
                      subscriptionStatus === 'active' ? (
                        <span className="text-sm font-medium text-primary-600">Current Plan</span>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => openBillingCheckout(process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY!)}
                        >
                          {subscriptionType === 'paid' ? 'Upgrade to Yearly' : 'Choose Yearly'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {isLifetimeFree && (
                <Card>
                  <p className="text-sm text-gray-600">
                    Aapko Lifetime Free access mila hua hai — koi billing zaroori nahi hai. &#127881;
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
