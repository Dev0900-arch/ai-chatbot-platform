'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ChatbotPage() {
  const { user } = useAuth()
  const [botName, setBotName] = useState('AI Assistant')
  const [businessName, setBusinessName] = useState('')
  const [registeredDomain, setRegisteredDomain] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! How can I help you today?')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')
  const [aiModel, setAiModel] = useState('openai/gpt-3.5-turbo')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  // Load user settings on mount
  useEffect(() => {
    if (user?.uid) {
      loadUserSettings()
    }
  }, [user?.uid])

  const loadUserSettings = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/user?firebaseUid=${user?.uid}`)
      if (res.ok) {
        const data = await res.json()
        if (data.botName) setBotName(data.botName)
        if (data.businessName) setBusinessName(data.businessName)
        if (data.registeredDomain) setRegisteredDomain(data.registeredDomain)
        if (data.welcomeMessage) setWelcomeMessage(data.welcomeMessage)
        if (data.primaryColor) setPrimaryColor(data.primaryColor)
        if (data.aiModel) setAiModel(data.aiModel)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setIsLoading(false)
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
      setMessage({ type: 'error', text: 'You must be signed in to save settings' })
      return
    }

    setIsSaving(true)
    setMessage(null)

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
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const copyEmbedCode = () => {
    if (!user?.uid) {
      setMessage({ type: 'error', text: 'You must be signed in to copy embed code' })
      return
    }
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Chatbot Widget</h2>
          <p className="text-gray-600 mt-1">Configure and preview your AI chatbot</p>
        </div>
        <Button onClick={copyEmbedCode} disabled={!user?.uid}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? 'Copied!' : 'Copy Embed Code'}
        </Button>
      </div>

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
              <p className="text-xs text-blue-600 mt-1">This ID uniquely identifies your chatbot. All leads and conversations are tied to this ID.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Bot Identity */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bot Identity</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Name
                </label>
                <Input
                  placeholder="AI Assistant"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Displayed in the widget header</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name
                </label>
                <Input
                  placeholder="My Business"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Used in AI responses for context</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registered Domain
                </label>
                <Input
                  placeholder="example.com"
                  value={registeredDomain}
                  onChange={(e) => setRegisteredDomain(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Widget only works on this domain (leave empty for any)</p>
              </div>
            </div>
          </Card>

          {/* Widget Appearance */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Widget Appearance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Welcome Message
                </label>
                <textarea
                  rows={3}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Hello! How can I help you today?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Color
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Model
                </label>
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

        {/* Live Preview - Updates in real-time */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Preview</h3>
          <p className="text-sm text-gray-500 mb-4">Preview updates as you type - no need to save first</p>
          <div className="bg-gray-100 rounded-lg p-4 min-h-[500px] flex items-end justify-end relative">
            {/* Simulated website background */}
            <div className="absolute inset-4 bg-white rounded-lg shadow-sm p-4 overflow-hidden">
              <div className="h-4 w-32 bg-gray-200 rounded mb-3"></div>
              <div className="h-3 w-full bg-gray-100 rounded mb-2"></div>
              <div className="h-3 w-3/4 bg-gray-100 rounded mb-2"></div>
              <div className="h-3 w-5/6 bg-gray-100 rounded mb-4"></div>
              <div className="h-20 w-full bg-gray-50 rounded mb-3"></div>
              <div className="h-3 w-2/3 bg-gray-100 rounded mb-2"></div>
              <div className="h-3 w-1/2 bg-gray-100 rounded"></div>
            </div>

            {/* Widget Preview */}
            <div className="relative z-10 w-80">
              {/* Chat Window */}
              <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                {/* Header */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: primaryColor }}
                >
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
                  <button className="text-white/80 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Messages */}
                <div className="p-4 h-64 overflow-y-auto bg-gray-50">
                  <div className="flex justify-start mb-3">
                    <div className="bg-white rounded-lg px-3 py-2 max-w-[80%] shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-800">{welcomeMessage || 'Hello! How can I help you today?'}</p>
                    </div>
                  </div>
                  <div className="flex justify-end mb-3">
                    <div
                      className="rounded-lg px-3 py-2 max-w-[80%] text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <p className="text-sm">Hi, I have a question about your services.</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white rounded-lg px-3 py-2 max-w-[80%] shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-800">Of course! I&apos;d be happy to help. What would you like to know?</p>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="p-3 border-t border-gray-200 bg-white">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled
                    />
                    <button
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: primaryColor }}
                      disabled
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

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
        {registeredDomain && (
          <p className="text-sm text-amber-600 mt-4 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            This widget will only work on: <strong className="ml-1">{registeredDomain}</strong>
          </p>
        )}
      </Card>

      {/* Testing Link */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Your Widget</h3>
        <p className="text-sm text-gray-600 mb-4">
          Try your chatbot on our demo page to see how it works on a real website.
        </p>
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
  )
}
