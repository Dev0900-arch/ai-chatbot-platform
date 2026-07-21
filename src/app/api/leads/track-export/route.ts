import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, leadCount, filterApplied } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find user by id or firebaseUid
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Save export record
    await prisma.leadExport.create({
      data: {
        userId: user.id,
        leadCount: leadCount || 0,
        filterApplied: filterApplied || 'all'
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track export error:', error)
    return NextResponse.json(
      { error: 'Failed to track export' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find user by id or firebaseUid
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json({
        totalExports: 0,
        totalLeadsExported: 0,
        exports: []
      })
    }

    // Get export history
    const exports = await prisma.leadExport.findMany({
      where: { userId: user.id },
      orderBy: { exportedAt: 'desc' },
      take: 50
    })

    // Calculate stats
    const totalExports = exports.length
    const totalLeadsExported = exports.reduce((sum, exp) => sum + exp.leadCount, 0)

    return NextResponse.json({
      totalExports,
      totalLeadsExported,
      exports: exports.map(exp => ({
        id: exp.id,
        date: exp.exportedAt,
        count: exp.leadCount,
        filter: exp.filterApplied
      }))
    })
  } catch (error) {
    console.error('Fetch exports error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch exports' },
      { status: 500 }
    )
  }
}
