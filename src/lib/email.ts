import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// Generic email sending function
interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: EmailOptions): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('Gmail credentials not configured, skipping email')
    return false
  }

  try {
    await transporter.sendMail({
      from: from || `"Uplync" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`Email sent successfully to ${to}`)
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

interface BuyingSignals {
  asked_pricing: boolean
  requested_demo: boolean
  mentioned_timeline: boolean
  discussed_budget: boolean
  asked_features: boolean
}

interface Indicators {
  urgency_level: 'high' | 'medium' | 'low'
  decision_authority: 'confirmed' | 'unclear'
  budget_indication: 'mentioned' | 'not_mentioned'
  competition_awareness: boolean
}

interface LeadEmailData {
  businessEmail: string
  businessName: string
  leadName: string
  leadEmail: string
  leadPhone?: string
  intentScore: string
  confidenceLevel: string
  buyingSignals: BuyingSignals
  indicators: Indicators
  aiReasoning: string
  conversationSummary: string
  aiRecommendation: string
  conversationHighlights: string[]
  conversationTranscript: string
  sourcePageUrl?: string
  dashboardLink: string
}

function getIntentEmoji(intentScore: string): string {
  const emojis: Record<string, string> = {
    hot: '🔥',
    warm: '☀️',
    cold: '❄️',
    spam: '🚫'
  }
  return emojis[intentScore] || '📧'
}

function getIntentColor(intentScore: string): { bg: string; border: string; text: string } {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    hot: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
    warm: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    cold: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    spam: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' }
  }
  return colors[intentScore] || colors.cold
}

function getUrgencyBadge(urgency: string): string {
  const badges: Record<string, string> = {
    high: '<span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">🚨 HIGH</span>',
    medium: '<span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">⚠️ MEDIUM</span>',
    low: '<span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">📊 LOW</span>'
  }
  return badges[urgency] || badges.low
}

function getConfidenceBadge(confidence: string): string {
  const badges: Record<string, string> = {
    high: '<span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">✓ High Confidence</span>',
    medium: '<span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">~ Medium Confidence</span>',
    low: '<span style="background: #f3f4f6; color: #374151; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">? Low Confidence</span>'
  }
  return badges[confidence] || badges.low
}

export async function sendLeadNotification(data: LeadEmailData): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('Gmail credentials not configured, skipping email notification')
    return false
  }

  const emoji = getIntentEmoji(data.intentScore)
  const colors = getIntentColor(data.intentScore)

  const intentLabels: Record<string, string> = {
    hot: 'HOT LEAD - Immediate Follow-up Required!',
    warm: 'WARM LEAD - Follow-up Within 24 Hours',
    cold: 'COLD LEAD - Add to Nurture Campaign',
    spam: 'SPAM/BOT - No Action Needed'
  }
  const label = intentLabels[data.intentScore] || 'New Lead'

  // Build buying signals list
  const signalsList: string[] = []
  if (data.buyingSignals.asked_pricing) signalsList.push('✅ Asked about pricing')
  if (data.buyingSignals.requested_demo) signalsList.push('✅ Requested demo/meeting')
  if (data.buyingSignals.mentioned_timeline) signalsList.push('✅ Mentioned timeline/urgency')
  if (data.buyingSignals.discussed_budget) signalsList.push('✅ Discussed budget')
  if (data.buyingSignals.asked_features) signalsList.push('✅ Asked about features')

  // Add negative signals if none detected
  if (signalsList.length === 0) {
    if (!data.buyingSignals.asked_pricing) signalsList.push('❌ Did not ask about pricing')
    if (!data.buyingSignals.mentioned_timeline) signalsList.push('❌ No timeline mentioned')
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${colors.border} 0%, ${colors.text} 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">${emoji}</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${label}</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">New lead from ${data.businessName} Chatbot</p>
    </div>

    <!-- Lead Information -->
    <div style="background: white; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">👤</span> Lead Information
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 100px;">Name:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">${data.leadName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${data.leadEmail}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${data.leadEmail}</a></td>
        </tr>
        ${data.leadPhone ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Phone:</td>
          <td style="padding: 8px 0;"><a href="tel:${data.leadPhone}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${data.leadPhone}</a></td>
        </tr>
        ` : ''}
        ${data.sourcePageUrl ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Source:</td>
          <td style="padding: 8px 0;"><a href="${data.sourcePageUrl}" style="color: #2563eb; text-decoration: none; font-size: 13px;">${data.sourcePageUrl}</a></td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Qualification Analysis -->
    <div style="background: ${colors.bg}; padding: 25px; border-left: 4px solid ${colors.border}; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
        <span style="margin-right: 8px;">🎯</span> AI Qualification Analysis
      </h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
        <div>
          <span style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Intent Score</span>
          <span style="background: ${colors.border}; color: white; padding: 6px 16px; border-radius: 9999px; font-size: 14px; font-weight: 700; text-transform: uppercase;">${emoji} ${data.intentScore}</span>
        </div>
        <div>
          <span style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Confidence</span>
          ${getConfidenceBadge(data.confidenceLevel)}
        </div>
        <div>
          <span style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Urgency</span>
          ${getUrgencyBadge(data.indicators.urgency_level)}
        </div>
      </div>
    </div>

    <!-- AI Reasoning -->
    <div style="background: white; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
        <span style="margin-right: 8px;">🧠</span> AI Reasoning
      </h2>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #6366f1;">
        <p style="margin: 0; color: #374151; line-height: 1.6; font-style: italic;">"${data.aiReasoning}"</p>
      </div>
    </div>

    <!-- Buying Signals -->
    <div style="background: #f9fafb; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
        <span style="margin-right: 8px;">📊</span> Buying Signals Detected
      </h2>
      <div style="display: grid; gap: 8px;">
        ${signalsList.map(signal => `<div style="font-size: 14px; color: #374151;">${signal}</div>`).join('')}
      </div>
    </div>

    <!-- Key Indicators -->
    <div style="background: white; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
        <span style="margin-right: 8px;">🔍</span> Key Indicators
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; background: #f9fafb; border-radius: 6px; width: 50%;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Urgency Level</div>
            <div style="font-weight: 600; color: #111827; text-transform: capitalize;">${data.indicators.urgency_level}</div>
          </td>
          <td style="padding: 10px; background: #f9fafb; border-radius: 6px; width: 50%;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Decision Authority</div>
            <div style="font-weight: 600; color: #111827; text-transform: capitalize;">${data.indicators.decision_authority}</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px; background: #f9fafb; border-radius: 6px; margin-top: 8px;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Budget Indication</div>
            <div style="font-weight: 600; color: #111827;">${data.indicators.budget_indication === 'mentioned' ? '💰 Mentioned' : '❓ Not Mentioned'}</div>
          </td>
          <td style="padding: 10px; background: #f9fafb; border-radius: 6px;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Competition Awareness</div>
            <div style="font-weight: 600; color: #111827;">${data.indicators.competition_awareness ? '⚔️ Yes' : '✓ No'}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Conversation Summary -->
    <div style="background: #f9fafb; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
        <span style="margin-right: 8px;">📝</span> Conversation Summary
      </h2>
      <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #374151; line-height: 1.6;">${data.conversationSummary}</p>
      </div>
    </div>

    <!-- Conversation Highlights -->
    ${data.conversationHighlights.length > 0 ? `
    <div style="background: white; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
        <span style="margin-right: 8px;">💬</span> Conversation Highlights
      </h2>
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        ${data.conversationHighlights.map(highlight => `<li style="margin-bottom: 8px; line-height: 1.5;">${highlight}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Recommendation -->
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-left: 4px solid #f59e0b; border-right: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">
        <span style="margin-right: 8px;">✅</span> Recommended Action
      </h2>
      <p style="margin: 0; color: #78350f; line-height: 1.6; font-weight: 500;">${data.aiRecommendation}</p>
    </div>

    <!-- Full Conversation -->
    <div style="background: #f9fafb; padding: 25px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <details style="cursor: pointer;">
        <summary style="font-weight: 600; color: #111827; margin-bottom: 15px; font-size: 16px;">
          <span style="margin-right: 8px;">📜</span> Full Conversation Transcript (Click to expand)
        </summary>
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; max-height: 400px; overflow-y: auto;">
          <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #374151; line-height: 1.6;">${data.conversationTranscript}</pre>
        </div>
      </details>
    </div>

    <!-- CTA Button -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; text-align: center;">
      <a href="${data.dashboardLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
        View in Dashboard →
      </a>
      <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 13px;">Reply to this email to send directly to ${data.leadEmail}</p>
    </div>

    <!-- Footer -->
    <div style="background: #1f2937; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Powered by <strong style="color: white;">Uplync</strong> AI Chatbot Platform
      </p>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 11px;">
        This is an automated notification. Lead was captured at ${new Date().toLocaleString()}.
      </p>
    </div>

  </div>
</body>
</html>
  `

  try {
    await transporter.sendMail({
      from: `"${data.businessName} Chatbot" <${process.env.GMAIL_USER}>`,
      to: data.businessEmail,
      replyTo: data.leadEmail,
      subject: `${emoji} [${data.intentScore.toUpperCase()}] New Lead: ${data.leadName} - ${data.confidenceLevel} confidence`,
      html: htmlContent,
    })
    console.log('Enhanced lead notification email sent successfully')
    return true
  } catch (error) {
    console.error('Failed to send lead notification email:', error)
    return false
  }
}
