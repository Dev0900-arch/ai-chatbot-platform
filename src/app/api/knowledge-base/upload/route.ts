import { NextRequest, NextResponse } from 'next/server'
import { prisma, getPrismaErrorMessage } from '@/lib/prisma'

// Helper to get user's internal ID from Firebase UID
async function getUserId(firebaseUid: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  })
  return user?.id || null
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return data.text
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString('utf-8')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const firebaseUid = formData.get('userId') as string | null
    const category = formData.get('category') as string | null
    const title = formData.get('title') as string | null

    if (!file || !firebaseUid) {
      return NextResponse.json(
        { error: 'File and userId are required' },
        { status: 400 }
      )
    }

    // Get internal user ID from Firebase UID
    const userId = await getUserId(firebaseUid)

    if (!userId) {
      return NextResponse.json(
        { error: 'User not found. Please sign in again.' },
        { status: 404 }
      )
    }

    // Get file info
    const fileName = file.name
    const fileExtension = fileName.split('.').pop()?.toLowerCase()

    // Validate file type
    const allowedTypes = ['pdf', 'docx', 'txt', 'md']
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PDF, DOCX, TXT, MD' },
        { status: 400 }
      )
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check file size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    // Extract text based on file type
    let extractedText = ''
    let fileType = fileExtension

    try {
      switch (fileExtension) {
        case 'pdf':
          extractedText = await extractTextFromPDF(buffer)
          break
        case 'docx':
          extractedText = await extractTextFromDOCX(buffer)
          break
        case 'txt':
        case 'md':
          extractedText = extractTextFromTXT(buffer)
          break
        default:
          throw new Error('Unsupported file type')
      }
    } catch (extractError) {
      console.error('Text extraction error:', extractError)
      return NextResponse.json(
        { error: 'Failed to extract text from file' },
        { status: 500 }
      )
    }

    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()

    if (!extractedText || extractedText.length < 10) {
      return NextResponse.json(
        { error: 'Could not extract meaningful text from the file' },
        { status: 400 }
      )
    }

    // Truncate if too long (max 50000 characters)
    if (extractedText.length > 50000) {
      extractedText = extractedText.substring(0, 50000) + '\n\n[Content truncated...]'
    }

    // Format the content
    const formattedContent = `# ${title || fileName}\n\n## Document Content\n\n${extractedText}`

    // Save to database
    const knowledgeBase = await prisma.knowledgeBase.create({
      data: {
        userId,
        title: title || fileName.replace(/\.[^/.]+$/, ''),
        content: formattedContent,
        category: category || 'Uploaded Document',
        sourceType: 'document_upload',
        fileName,
        fileType,
      },
    })

    return NextResponse.json({
      success: true,
      data: knowledgeBase,
      stats: {
        fileName,
        fileType,
        characterCount: extractedText.length,
        wordCount: extractedText.split(/\s+/).length,
      },
    })
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}
