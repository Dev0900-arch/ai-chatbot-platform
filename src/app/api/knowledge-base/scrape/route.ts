import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { prisma, getPrismaErrorMessage } from '@/lib/prisma'

interface ScrapedContent {
  title: string
  headings: string[]
  paragraphs: string[]
  listItems: string[]
  metaDescription: string
  pricingInfo: string[]
  additionalText: string[]
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// Retry logic for scraping
async function scrapeWithRetry(url: string, maxRetries: number = 3): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, 30000) // 30 second timeout

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')

      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          lastError = new Error(`Request timed out after 30 seconds (attempt ${attempt}/${maxRetries})`)
        }
        // Don't retry on 4xx errors (client errors)
        if (error.message.includes('HTTP 4')) {
          throw error
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
      }
    }
  }

  throw lastError || new Error('Failed to fetch URL after multiple attempts')
}

async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const response = await scrapeWithRetry(url)
  const html = await response.text()
  const $ = cheerio.load(html)

  // Remove script and style elements (but keep nav/header/footer - they may have useful info)
  $('script, style, noscript, iframe, svg').remove()

  // Extract title
  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled'

  // Extract meta description
  const metaDescription = $('meta[name="description"]').attr('content') || ''

  // Extract headings
  const headings: string[] = []
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length > 2) {
      headings.push(text)
    }
  })

  // Extract paragraphs
  const paragraphs: string[] = []
  $('p').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length > 10) {
      paragraphs.push(text)
    }
  })

  // Extract list items (useful for features, services, etc.)
  const listItems: string[] = []
  $('li').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length > 3 && text.length < 500) {
      listItems.push(text)
    }
  })

  // Extract pricing information specifically - look for $ signs, pricing patterns
  const pricingInfo: string[] = []
  const seenPricing = new Set<string>()
  $('*').each((_, el) => {
    const text = $(el).text().trim()
    // Look for pricing patterns: $X, $X/month, $X.XX, free trial, etc.
    if (text && text.length < 200 && /(\$\d+|\bfree\s*trial\b|\bpricing\b|\bper\s*month\b|\bmonthly\b|\bannual\b|\bbilled\b)/i.test(text)) {
      // Get the closest meaningful text block
      const cleanText = text.replace(/\s+/g, ' ').trim()
      if (cleanText.length > 3 && cleanText.length < 200 && !seenPricing.has(cleanText)) {
        seenPricing.add(cleanText)
        pricingInfo.push(cleanText)
      }
    }
  })

  // Extract additional text from divs, spans, strong, b, a that contain meaningful content
  // This catches pricing, CTAs, feature highlights etc. that aren't in <p> tags
  const additionalText: string[] = []
  const seenText = new Set<string>()
  // Add all paragraph text to seen set to avoid duplicates
  paragraphs.forEach(p => seenText.add(p))
  headings.forEach(h => seenText.add(h))
  listItems.forEach(li => seenText.add(li))

  $('div, span, strong, b, a, td, th, label, blockquote').each((_, el) => {
    const $el = $(el)
    // Only get direct text content (not children) to avoid duplication
    const directText = $el.contents().filter(function() {
      return this.type === 'text'
    }).text().trim()

    if (directText && directText.length > 5 && directText.length < 500 && !seenText.has(directText)) {
      seenText.add(directText)
      additionalText.push(directText)
    }
  })

  return {
    title,
    headings: headings.slice(0, 50),
    paragraphs: paragraphs.slice(0, 100),
    listItems: listItems.slice(0, 100),
    metaDescription,
    pricingInfo: pricingInfo.slice(0, 20),
    additionalText: additionalText.slice(0, 100),
  }
}

function formatScrapedContent(content: ScrapedContent, url: string): string {
  let formatted = `# Content from: ${url}\n\n`

  if (content.title) {
    formatted += `## Page Title\n${content.title}\n\n`
  }

  if (content.metaDescription) {
    formatted += `## Description\n${content.metaDescription}\n\n`
  }

  // Pricing info first - most important for AI to know
  if (content.pricingInfo.length > 0) {
    formatted += `## Pricing Information\n`
    content.pricingInfo.forEach(p => {
      formatted += `- ${p}\n`
    })
    formatted += '\n'
  }

  if (content.headings.length > 0) {
    formatted += `## Key Topics\n`
    content.headings.forEach(h => {
      formatted += `- ${h}\n`
    })
    formatted += '\n'
  }

  if (content.paragraphs.length > 0) {
    formatted += `## Content\n`
    content.paragraphs.forEach(p => {
      formatted += `${p}\n\n`
    })
  }

  if (content.listItems.length > 0) {
    formatted += `## Features & Details\n`
    content.listItems.forEach(li => {
      formatted += `- ${li}\n`
    })
    formatted += '\n'
  }

  if (content.additionalText.length > 0) {
    formatted += `## Additional Information\n`
    content.additionalText.forEach(text => {
      formatted += `- ${text}\n`
    })
  }

  return formatted
}

// Helper to get user's internal ID from Firebase UID
async function getUserId(firebaseUid: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  })
  return user?.id || null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, userId: firebaseUid, category } = body

    if (!url || !firebaseUid) {
      return NextResponse.json(
        { error: 'URL and userId are required' },
        { status: 400 }
      )
    }

    // Get internal user ID from Firebase UID
    const userId = await getUserId(firebaseUid)

    if (!userId) {
      return NextResponse.json(
        { error: 'User not found. Please sign in again to sync your account.' },
        { status: 404 }
      )
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Scrape the URL
    const scrapedContent = await scrapeUrl(url)

    // Format content for storage
    const formattedContent = formatScrapedContent(scrapedContent, url)

    // Save to database
    const knowledgeBase = await prisma.knowledgeBase.create({
      data: {
        userId,
        title: scrapedContent.title || parsedUrl.hostname,
        content: formattedContent,
        category: category || 'Website Content',
        sourceType: 'url_scrape',
        sourceUrl: url,
        scrapedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: knowledgeBase,
      stats: {
        headingsFound: scrapedContent.headings.length,
        paragraphsFound: scrapedContent.paragraphs.length,
        listItemsFound: scrapedContent.listItems.length,
        pricingFound: scrapedContent.pricingInfo.length,
        additionalTextFound: scrapedContent.additionalText.length,
      },
    })
  } catch (error) {
    console.error('URL scraping error:', error)

    // Provide user-friendly error messages
    let errorMessage = 'Failed to scrape URL'
    let statusCode = 500

    if (error instanceof Error) {
      const msg = error.message.toLowerCase()

      if (error.name === 'AbortError' || msg.includes('timeout')) {
        errorMessage = 'The website took too long to respond. Please try again or check if the URL is accessible.'
        statusCode = 504
      } else if (msg.includes('http 404')) {
        errorMessage = 'Page not found. Please check the URL and try again.'
        statusCode = 404
      } else if (msg.includes('http 403')) {
        errorMessage = 'Access denied. This website may be blocking automated requests.'
        statusCode = 403
      } else if (msg.includes('http 5')) {
        errorMessage = 'The website is experiencing issues. Please try again later.'
        statusCode = 502
      } else if (msg.includes('connect') || msg.includes('econnrefused') || msg.includes('enotfound')) {
        errorMessage = 'Could not connect to the website. Please check if the URL is correct and the site is online.'
        statusCode = 503
      } else if (msg.includes('certificate') || msg.includes('ssl') || msg.includes('https')) {
        errorMessage = 'SSL/Security error. The website may have certificate issues.'
        statusCode = 495
      } else if (msg.includes('prisma') || msg.includes('database')) {
        errorMessage = getPrismaErrorMessage(error)
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
