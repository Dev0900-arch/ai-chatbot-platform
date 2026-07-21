'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

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

export default function KnowledgeBasePage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState<KnowledgeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapeCategory, setScrapeCategory] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch knowledge base items
  const fetchArticles = async () => {
    if (!user?.uid) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/knowledge-base?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.uid) {
      fetchArticles()
    }
  }, [user?.uid])

  // Handle URL scraping
  const handleScrapeUrl = async () => {
    if (!user?.uid) {
      setMessage({ type: 'error', text: 'You must be signed in to scrape URLs' })
      return
    }

    if (!scrapeUrl) {
      setMessage({ type: 'error', text: 'Please enter a URL to scrape' })
      return
    }

    setIsScraping(true)
    setMessage(null)

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
        setMessage({
          type: 'success',
          text: `Successfully scraped! Found ${data.stats.headingsFound} headings, ${data.stats.paragraphsFound} paragraphs.`,
        })
        setScrapeUrl('')
        setScrapeCategory('')
        fetchArticles()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to scrape URL' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to scrape URL. Please check the URL and try again.' })
    } finally {
      setIsScraping(false)
    }
  }

  // Process files (shared by input change and drag-drop)
  const processFiles = async (files: FileList | File[]) => {
    if (!user?.uid) {
      setMessage({ type: 'error', text: 'You must be signed in to upload files' })
      return
    }

    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setIsUploading(true)
    setMessage(null)

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
      setMessage({
        type: 'success',
        text: `Successfully uploaded ${successCount} file(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
      })
      fetchArticles()
    } else {
      setMessage({ type: 'error', text: 'Failed to upload files. Please try again.' })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle file input change
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await processFiles(files)
    }
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!user?.uid) {
      setMessage({ type: 'error', text: 'You must be signed in to delete items' })
      return
    }

    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const res = await fetch(`/api/knowledge-base?id=${id}&userId=${user.uid}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Item deleted successfully' })
        fetchArticles()
      } else {
        setMessage({ type: 'error', text: 'Failed to delete item' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete item' })
    }
  }

  // Get source type icon
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

  // Get source badge
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

  // Filter articles
  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !filterCategory || article.category === filterCategory
    return matchesSearch && matchesCategory
  })

  // Get unique categories
  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Base</h2>
          <p className="text-gray-600 mt-1">Manage content that powers your AI chatbot</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">{articles.length} items</span>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {message.text}
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
            Import from Website URL (Optional)
          </span>
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Scrape content from any public website to train your chatbot. Great for importing product pages, FAQs, and service descriptions.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="https://example.com/about"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              disabled={isScraping}
            />
          </div>
          <div className="w-full sm:w-48">
            <Input
              placeholder="Category (optional)"
              value={scrapeCategory}
              onChange={(e) => setScrapeCategory(e.target.value)}
              disabled={isScraping}
            />
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
            id="file-upload"
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
              <p className="text-sm text-gray-500">Supports PDF, TXT, DOCX, and MD files (max 10MB each)</p>
              <span className="inline-block mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Browse Files
              </span>
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
        {isLoading ? (
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
                      {article.sourceUrl && (
                        <p className="text-xs text-gray-400 mt-1 truncate max-w-md">
                          {article.sourceUrl}
                        </p>
                      )}
                      {article.fileName && (
                        <p className="text-xs text-gray-400 mt-1">
                          File: {article.fileName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
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
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
