import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, visitorId, name, email, phone, purpose, sourcePageUrl } = body

    // Backend validation
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400, headers: corsHeaders })
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders })
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400, headers: corsHeaders })
    }
    if (!purpose || !purpose.trim()) {
      return NextResponse.json({ error: 'Purpose is required' }, { status: 400, headers: corsHeaders })
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
    }

    // Create conversation with purpose and pre-filled lead data
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        visitorId: visitorId || 'anonymous',
        title: `${name} - ${purpose}`,
        sourcePageUrl: sourcePageUrl || null,
        chatPurpose: purpose,
        leadCollectionState: 'complete',
        collectedName: name,
        collectedEmail: email,
        collectedPhone: phone || null,
        visitorEmail: email,
        visitorMessageCount: 0
      }
    })

    // Create lead immediately
    const lead = await prisma.lead.create({
      data: {
        userId: user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || undefined,
        source: 'chatbot_widget_form',
        sourcePageUrl: sourcePageUrl || null,
        status: 'new',
        conversationSummary: `Lead submitted pre-chat form. Purpose: ${purpose}`
      }
    })

    // Link lead to conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { leadId: lead.id }
    })

    console.log(`[Form] Lead created: ${lead.id}, Name: ${name}, Purpose: ${purpose}`)

    // Send email notification to business owner (non-blocking)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })

    sendEmail({
      to: user.email,
      subject: `New Lead: ${name} - ${purpose}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background: #2563eb; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">New Lead from Chatbot</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${user.businessName || 'Your business'}</p>
          </div>

          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
              Lead submitted form from: <strong>${sourcePageUrl || 'Chatbot widget'}</strong>
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; width: 100px; font-size: 14px;">Name:</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 600; color: #111827; font-size: 14px;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 14px;">Email:</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 14px;">Phone:</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">${phone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 14px;">Purpose:</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 600; color: #111827; font-size: 14px;">${purpose}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #6b7280; font-size: 14px;">Submitted:</td>
                <td style="padding: 10px; font-size: 14px; color: #374151;">${timestamp}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${appUrl}/leads"
                 style="background: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">
                View in Dashboard
              </a>
            </div>
          </div>

          <div style="background: #f9fafb; padding: 12px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Powered by Uplync AI Chatbot</p>
          </div>
        </body>
        </html>
      `
    }).catch(err => console.error('Lead form email failed:', err))

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      leadId: lead.id
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Widget form submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit form' },
      { status: 500, headers: corsHeaders }
    )
  }
}
