import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMessage } from '@/lib/openrouter'
import { sendLeadNotification } from '@/lib/email'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

interface Message {
  role: string
  content: string
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

interface EnhancedAnalysis {
  name: string | null
  email: string | null
  phone: string | null
  intent_score: 'hot' | 'warm' | 'cold' | 'spam'
  confidence_level: 'high' | 'medium' | 'low'
  buying_signals: BuyingSignals
  indicators: Indicators
  reasoning: string
  summary: string
  recommendation: string
  conversation_highlights: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, conversationId, messages } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] }
    })

    // User must exist - no demo mode
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please provide a valid userId.' },
        { status: 404, headers: corsHeaders }
      )
    }

    // If no conversationId, return success (nothing to analyze)
    if (!conversationId) {
      return NextResponse.json({
        success: true,
        message: 'No conversation to analyze'
      }, { headers: corsHeaders })
    }

    // Get conversation with lead
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: true,
        messages: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!conversation) {
      return NextResponse.json({
        success: true,
        message: 'Conversation not found'
      }, { headers: corsHeaders })
    }

    // Skip if already analyzed
    if (conversation.isAnalyzed) {
      return NextResponse.json({
        success: true,
        message: 'Already analyzed',
        intentScore: conversation.lead?.intentScore
      }, { headers: corsHeaders })
    }

    // Use provided messages or fetch from DB
    const conversationMessages: Message[] = messages || conversation.messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    if (conversationMessages.length < 2) {
      return NextResponse.json({
        success: true,
        message: 'Not enough messages to analyze'
      }, { headers: corsHeaders })
    }

    // Build conversation transcript
    const transcript = conversationMessages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`)
      .join('\n')

    // Enhanced AI analysis prompt
    const analysisPrompt = `You are a sales intelligence analyst. Analyze this customer service chat conversation and provide a comprehensive lead qualification analysis.

CONVERSATION:
${transcript}

Analyze the conversation and respond with ONLY a JSON object in this exact format (no markdown, no explanation, just the JSON):

{
  "name": "extracted visitor name or null if not provided",
  "email": "extracted email or null if not provided",
  "phone": "extracted phone or null if not provided",
  "intent_score": "hot|warm|cold|spam",
  "confidence_level": "high|medium|low",
  "buying_signals": {
    "asked_pricing": true/false,
    "requested_demo": true/false,
    "mentioned_timeline": true/false,
    "discussed_budget": true/false,
    "asked_features": true/false
  },
  "indicators": {
    "urgency_level": "high|medium|low",
    "decision_authority": "confirmed|unclear",
    "budget_indication": "mentioned|not_mentioned",
    "competition_awareness": true/false
  },
  "reasoning": "Detailed 2-4 sentence explanation of WHY you classified this lead this way. Be specific about what signals you detected.",
  "summary": "2-3 sentence summary of what the visitor wanted and discussed",
  "recommendation": "Specific actionable next step for the sales team",
  "conversation_highlights": ["Key point 1 from conversation", "Key point 2", "Key point 3"]
}

CLASSIFICATION GUIDELINES:
- HOT: Clear buying intent (asked pricing, requested demo, mentioned timeline/urgency, discussed budget)
- WARM: Genuine interest (asked specific product questions, engaged meaningfully, but no clear buying signals)
- COLD: Just browsing (general questions only, no specific interest, low engagement)
- SPAM: Bot-like behavior, irrelevant messages, or testing

IMPORTANT:
- Only extract contact info (name, email, phone) that the visitor EXPLICITLY provided
- Be specific in your reasoning - mention actual signals you detected
- Conversation highlights should be the most important/relevant visitor messages
- Provide actionable recommendations based on the intent level`

    const aiResponse = await sendMessage([
      { role: 'system', content: 'You are a sales intelligence analyst. Output only valid JSON, no markdown or explanations.' },
      { role: 'user', content: analysisPrompt }
    ], 'openai/gpt-4-turbo')

    const responseText = aiResponse.choices?.[0]?.message?.content || ''

    // Default analysis structure
    let analysis: EnhancedAnalysis = {
      name: null,
      email: null,
      phone: null,
      intent_score: 'cold',
      confidence_level: 'low',
      buying_signals: {
        asked_pricing: false,
        requested_demo: false,
        mentioned_timeline: false,
        discussed_budget: false,
        asked_features: false
      },
      indicators: {
        urgency_level: 'low',
        decision_authority: 'unclear',
        budget_indication: 'not_mentioned',
        competition_awareness: false
      },
      reasoning: 'Unable to fully analyze the conversation.',
      summary: 'Unable to analyze conversation',
      recommendation: 'Review conversation manually',
      conversation_highlights: []
    }

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        analysis = {
          name: parsed.name && parsed.name !== 'null' ? parsed.name : null,
          email: parsed.email && parsed.email !== 'null' ? parsed.email : null,
          phone: parsed.phone && parsed.phone !== 'null' ? parsed.phone : null,
          intent_score: parsed.intent_score || 'cold',
          confidence_level: parsed.confidence_level || 'low',
          buying_signals: {
            asked_pricing: Boolean(parsed.buying_signals?.asked_pricing),
            requested_demo: Boolean(parsed.buying_signals?.requested_demo),
            mentioned_timeline: Boolean(parsed.buying_signals?.mentioned_timeline),
            discussed_budget: Boolean(parsed.buying_signals?.discussed_budget),
            asked_features: Boolean(parsed.buying_signals?.asked_features)
          },
          indicators: {
            urgency_level: parsed.indicators?.urgency_level || 'low',
            decision_authority: parsed.indicators?.decision_authority || 'unclear',
            budget_indication: parsed.indicators?.budget_indication || 'not_mentioned',
            competition_awareness: Boolean(parsed.indicators?.competition_awareness)
          },
          reasoning: parsed.reasoning || 'Unable to determine specific reasoning.',
          summary: parsed.summary || 'Unable to analyze conversation',
          recommendation: parsed.recommendation || 'Review conversation manually',
          conversation_highlights: Array.isArray(parsed.conversation_highlights)
            ? parsed.conversation_highlights
            : []
        }
      }
    } catch (e) {
      console.error('Failed to parse AI analysis:', e)
    }

    // Update conversation as analyzed
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isAnalyzed: true,
        analyzedAt: new Date()
      }
    })

    // Determine lead name and email from AI extraction or fallback to anonymous
    const visitorId = conversation.visitorId || `anon_${Date.now()}`
    const leadName = analysis.name || 'Anonymous Visitor'
    const leadEmail = analysis.email || `${visitorId}@anonymous.visitor`

    // Update or create lead with enhanced analysis
    let lead = conversation.lead

    if (lead) {
      // Update existing lead
      const updateData: Record<string, unknown> = {
        intentScore: analysis.intent_score,
        conversationSummary: analysis.summary,
        aiRecommendation: analysis.recommendation,
        confidenceLevel: analysis.confidence_level,
        buyingSignals: JSON.stringify(analysis.buying_signals),
        indicators: JSON.stringify(analysis.indicators),
        aiReasoning: analysis.reasoning,
        conversationHighlights: JSON.stringify(analysis.conversation_highlights)
      }

      // Only update name if AI extracted one and current is Anonymous
      if (analysis.name && lead.name === 'Anonymous Visitor') {
        updateData.name = analysis.name
      }
      // Only update email if AI extracted one and current is anonymous
      if (analysis.email && lead.email.includes('@anonymous.visitor')) {
        updateData.email = analysis.email
      }
      // Add phone if extracted
      if (analysis.phone && !lead.phone) {
        updateData.phone = analysis.phone
      }

      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: updateData
      })
    } else {
      // Create lead if doesn't exist
      lead = await prisma.lead.create({
        data: {
          userId: user.id,
          name: leadName,
          email: leadEmail,
          phone: analysis.phone || undefined,
          source: 'chatbot_widget',
          sourcePageUrl: conversation.sourcePageUrl || undefined,
          intentScore: analysis.intent_score,
          conversationSummary: analysis.summary,
          aiRecommendation: analysis.recommendation,
          confidenceLevel: analysis.confidence_level,
          buyingSignals: JSON.stringify(analysis.buying_signals),
          indicators: JSON.stringify(analysis.indicators),
          aiReasoning: analysis.reasoning,
          conversationHighlights: JSON.stringify(analysis.conversation_highlights),
          status: 'new'
        }
      })

      // Link lead to conversation
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { leadId: lead.id }
      })
    }

    // Send enhanced email notification for hot and warm leads
    if (['hot', 'warm'].includes(analysis.intent_score)) {
      await sendLeadNotification({
        businessEmail: user.email,
        businessName: user.businessName || 'Your Business',
        leadName: lead.name,
        leadEmail: lead.email,
        leadPhone: lead.phone || undefined,
        intentScore: analysis.intent_score,
        confidenceLevel: analysis.confidence_level,
        buyingSignals: analysis.buying_signals,
        indicators: analysis.indicators,
        aiReasoning: analysis.reasoning,
        conversationSummary: analysis.summary,
        aiRecommendation: analysis.recommendation,
        conversationHighlights: analysis.conversation_highlights,
        conversationTranscript: transcript,
        sourcePageUrl: lead.sourcePageUrl || undefined,
        dashboardLink: `https://chat.uplync.io/leads`
      })
    }

    return NextResponse.json({
      success: true,
      analysis,
      leadId: lead.id,
      emailSent: ['hot', 'warm'].includes(analysis.intent_score)
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Lead analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze conversation' },
      { status: 500, headers: corsHeaders }
    )
  }
}
