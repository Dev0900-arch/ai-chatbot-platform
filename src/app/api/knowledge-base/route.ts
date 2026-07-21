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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const firebaseUid = searchParams.get('userId') // Frontend passes Firebase UID as userId
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get internal user ID from Firebase UID
    const userId = await getUserId(firebaseUid)

    if (!userId) {
      // User not synced yet - return empty array
      return NextResponse.json([])
    }

    const articles = await prisma.knowledgeBase.findMany({
      where: {
        userId,
        ...(category && { category }),
        ...(search && {
          OR: [
            { title: { contains: search } },
            { content: { contains: search } },
          ],
        }),
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(articles)
  } catch (error) {
    console.error('Knowledge Base GET error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId: firebaseUid, title, content, category } = body

    if (!firebaseUid || !title || !content) {
      return NextResponse.json(
        { error: 'User ID, title, and content are required' },
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

    const article = await prisma.knowledgeBase.create({
      data: {
        userId,
        title,
        content,
        category,
      },
    })

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    console.error('Knowledge Base POST error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId: firebaseUid, title, content, category } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      )
    }

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'User ID is required' },
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

    // Verify the article belongs to the user
    const existingArticle = await prisma.knowledgeBase.findFirst({
      where: { id, userId }
    })

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Article not found or not authorized' },
        { status: 404 }
      )
    }

    const article = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(category !== undefined && { category }),
      },
    })

    return NextResponse.json(article)
  } catch (error) {
    console.error('Knowledge Base PUT error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const firebaseUid = searchParams.get('userId')

    if (!id) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      )
    }

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'User ID is required' },
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

    // Verify the article belongs to the user
    const existingArticle = await prisma.knowledgeBase.findFirst({
      where: { id, userId }
    })

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Article not found or not authorized' },
        { status: 404 }
      )
    }

    await prisma.knowledgeBase.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Knowledge Base DELETE error:', error)
    return NextResponse.json(
      { error: getPrismaErrorMessage(error) },
      { status: 500 }
    )
  }
}
