import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId } = body

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        user: true,
        conversation: {
          include: { messages: { orderBy: { createdAt: 'asc' } } }
        }
      }
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Format conversation transcript
    const conversationText = lead.conversation?.messages
      .map(m => `${m.role === 'user' ? 'Visitor' : 'AI'}: ${m.content}`)
      .join('\n') || 'No conversation available'

    const intentEmoji: Record<string, string> = {
      hot: '🔥',
      warm: '☀️',
      cold: '❄️',
      spam: '🚫'
    }
    const emoji = intentEmoji[lead.intentScore || ''] || '📋'
    const intentLabel = (lead.intentScore || 'new').toUpperCase()
    const headerColor = lead.intentScore === 'hot' ? '#dc2626' : lead.intentScore === 'warm' ? '#f59e0b' : '#3b82f6'

    await sendEmail({
      to: lead.user.email,
      subject: `${emoji} New ${intentLabel} Lead: ${lead.name} - Uplync`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background: ${headerColor}; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">${emoji} New ${intentLabel} Lead!</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">From ${lead.user.businessName || 'your'} chatbot</p>
          </div>

          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="margin: 0 0 12px; font-size: 16px; color: #111827;">Contact Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 80px;">Name:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${lead.name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Email:</td>
                <td style="padding: 6px 0;"><a href="mailto:${lead.email}" style="color: #2563eb;">${lead.email}</a></td>
              </tr>
              ${lead.phone ? `
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Phone:</td>
                <td style="padding: 6px 0;"><a href="tel:${lead.phone}" style="color: #2563eb;">${lead.phone}</a></td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Source:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #374151;">${lead.sourcePageUrl || 'Chatbot widget'}</td>
              </tr>
            </table>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">

            <h2 style="margin: 0 0 12px; font-size: 16px; color: #111827;">Conversation</h2>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-family: monospace; font-size: 12px; color: #374151; max-height: 300px; overflow-y: auto; line-height: 1.5;">
${conversationText}
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/leads"
                 style="background: #3b82f6; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">
                View in Dashboard
              </a>
            </div>
          </div>

          <div style="background: #f9fafb; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              Powered by Uplync AI Chatbot Platform
            </p>
          </div>
        </body>
        </html>
      `
    })

    console.log(`Lead notification email sent to ${lead.user.email}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lead notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
