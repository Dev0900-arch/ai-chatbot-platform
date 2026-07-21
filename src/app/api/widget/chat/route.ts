import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMessage } from '@/lib/openrouter'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Lead collection states
type LeadState = 'normal' | 'asking' | 'collecting_name' | 'collecting_email' | 'collecting_phone' | 'complete' | 'declined'

// Extract email from text using regex
function extractEmail(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
  const matches = text.match(emailRegex)
  return matches ? matches[0].toLowerCase() : null
}

// Extract phone from text using regex
function extractPhone(text: string): string | null {
  // Match various phone formats
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}|\d{10,}/g
  const matches = text.match(phoneRegex)
  if (matches) {
    // Clean up the phone number
    const phone = matches[0].replace(/[^\d+]/g, '')
    if (phone.length >= 10) {
      return phone
    }
  }
  return null
}

// Extract name from text - look for common patterns
function extractName(text: string): string | null {
  const lowerText = text.toLowerCase()

  // Common patterns: "my name is X", "I'm X", "I am X", "call me X", "it's X", "this is X"
  const patterns = [
    /my name is\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /i'?m\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /i am\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /call me\s+([a-zA-Z]+)/i,
    /it'?s\s+([a-zA-Z]+)/i,
    /this is\s+([a-zA-Z]+)/i,
    /name:?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      // Filter out common words that aren't names
      const skipWords = ['hi', 'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'thank', 'please', 'just', 'actually', 'really']
      if (!skipWords.includes(name.toLowerCase()) && name.length > 1) {
        return name.charAt(0).toUpperCase() + name.slice(1)
      }
    }
  }

  // If the message is short (1-3 words) and looks like a name, use it
  const words = text.trim().split(/\s+/)
  if (words.length <= 3 && words.length >= 1) {
    const potentialName = words[0]
    // Check if it's a capitalized word that could be a name
    if (/^[A-Z][a-z]+$/.test(potentialName) && potentialName.length > 1) {
      const skipWords = ['Hi', 'Hello', 'Hey', 'Yes', 'No', 'Ok', 'Okay', 'Sure', 'Thanks', 'Thank', 'Please']
      if (!skipWords.includes(potentialName)) {
        return words.slice(0, 2).join(' ') // Take up to 2 words as name
      }
    }
  }

  return null
}

// Check if user is declining to provide info
function isDecline(text: string): boolean {
  const declinePatterns = [
    /no\s*(thanks?|thank you)?/i,
    /i('?d)?\s*(rather|prefer)\s*not/i,
    /don'?t\s*want\s*to/i,
    /skip/i,
    /not\s*(right\s*)?now/i,
    /maybe\s*later/i,
    /i'?ll\s*pass/i,
    /no\s*way/i,
    /nope/i,
    /nah/i,
  ]

  const lowerText = text.toLowerCase().trim()
  return declinePatterns.some(pattern => pattern.test(lowerText))
}

// Try to extract all info at once (name, email, phone from single message)
function extractAllInfo(text: string): { name: string | null; email: string | null; phone: string | null } {
  return {
    name: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text)
  }
}

// Extract verified facts from knowledge base content
function extractVerifiedFacts(knowledgeContent: string): { trialDays: string | null; pricing: string | null; allFacts: string[] } {
  const facts: string[] = []
  let trialDays: string | null = null
  let pricing: string | null = null

  // Extract trial period
  const trialPatterns = [
    /(\d+)[\s-]*day\s*(free\s*)?trial/i,
    /free\s*trial\s*(?:of|for)?\s*(\d+)\s*days?/i,
    /trial\s*(?:period|length)?\s*(?:is|:)?\s*(\d+)\s*days?/i,
  ]
  for (const pattern of trialPatterns) {
    const match = knowledgeContent.match(pattern)
    if (match) {
      trialDays = match[1]
      facts.push(`Free Trial: ${trialDays} days`)
      break
    }
  }

  // Extract pricing
  const pricingPatterns = [
    /\$(\d+(?:\.\d{2})?)\s*(?:\/|\s*per\s*)\s*month/i,
    /(\d+(?:\.\d{2})?)\s*(?:USD|dollars?)\s*(?:\/|\s*per\s*)\s*month/i,
    /monthly\s*(?:price|cost|fee|plan)\s*(?:is|:)?\s*\$?(\d+(?:\.\d{2})?)/i,
    /pricing\s*(?:is|:)?\s*\$(\d+(?:\.\d{2})?)/i,
  ]
  for (const pattern of pricingPatterns) {
    const match = knowledgeContent.match(pattern)
    if (match) {
      pricing = `$${match[1]}/month`
      facts.push(`Pricing: ${pricing}`)
      break
    }
  }

  console.log('[AI Facts] Extracted from KB:', { trialDays, pricing, allFacts: facts })
  return { trialDays, pricing, allFacts: facts }
}

// Post-process AI response to correct hallucinated facts
function validateAIResponse(response: string, facts: { trialDays: string | null; pricing: string | null }): string {
  let corrected = response

  // Fix wrong trial days
  if (facts.trialDays) {
    const correctDays = facts.trialDays
    const wrongTrialPatterns = [
      /(\d+)[\s-]*day\s*(free\s*)?trial/gi,
      /free\s*trial\s*(?:of|for)?\s*(\d+)\s*days?/gi,
      /trial\s*(?:period|length)?\s*(?:is|of)?\s*(\d+)\s*days?/gi,
    ]
    for (const pattern of wrongTrialPatterns) {
      corrected = corrected.replace(pattern, (match, num) => {
        if (num !== correctDays) {
          console.log(`[AI Facts] CORRECTED trial days: "${num}" → "${correctDays}"`)
          return match.replace(num, correctDays)
        }
        return match
      })
    }
  }

  // Fix wrong pricing
  if (facts.pricing) {
    const correctPrice = facts.pricing.replace('/month', '')
    const wrongPricePatterns = [
      /\$(\d+(?:\.\d{2})?)\s*(?:\/|\s*per\s*)\s*month/gi,
      /\$(\d+(?:\.\d{2})?)\s*(?:a|each)\s*month/gi,
    ]
    for (const pattern of wrongPricePatterns) {
      corrected = corrected.replace(pattern, (match, num) => {
        if (`$${num}` !== correctPrice) {
          console.log(`[AI Facts] CORRECTED pricing: "$${num}" → "${correctPrice}"`)
          return match.replace(`$${num}`, correctPrice)
        }
        return match
      })
    }
  }

  return corrected
}

// Get purpose-specific guidance for AI
function getPurposeGuidance(chatPurpose: string | null): string {
  if (!chatPurpose) return ''

  const purposeLower = chatPurpose.toLowerCase()

  if (purposeLower.includes('pricing')) {
    return `\n\nVISITOR PURPOSE: This visitor wants to see PRICING information.
- Focus on: pricing, plans, costs, billing, discounts, free trials
- Lead with pricing info when relevant
- Answer exactly what they ask - don't pivot to other topics unless they ask`
  }

  if (purposeLower.includes('features') || purposeLower.includes('interested in')) {
    return `\n\nVISITOR PURPOSE: This visitor is interested in FEATURES and CAPABILITIES.
- Focus on: features, capabilities, what the product does, use cases, benefits
- Answer exactly what they ask - don't pivot to other topics unless they ask`
  }

  if (purposeLower.includes('support') || purposeLower.includes('technical')) {
    return `\n\nVISITOR PURPOSE: This visitor needs TECHNICAL SUPPORT.
- Focus on: troubleshooting, how-to guides, technical questions, setup help
- Be solution-oriented and step-by-step
- Ask clarifying questions to understand their issue
- If they go off-topic, gently redirect: "I can help with that! But let me first make sure we resolve your technical question."`
  }

  if (purposeLower.includes('partnership')) {
    return `\n\nVISITOR PURPOSE: This visitor is interested in a PARTNERSHIP opportunity.
- Focus on: partnership options, collaboration, business opportunities, integration
- Be professional and business-oriented
- Highlight partnership benefits and next steps
- Encourage them to schedule a call or meeting for detailed discussion`
  }

  // General inquiry or unknown purpose
  return `\n\nVISITOR PURPOSE: General inquiry - "${chatPurpose}"
- Help them with whatever they need
- Be friendly and informative`
}

// Get system prompt based on collection state
function getSystemPrompt(
  businessName: string,
  knowledgeContext: string,
  state: LeadState,
  collectedName?: string | null,
  collectedEmail?: string | null,
  verifiedFacts?: { trialDays: string | null; pricing: string | null; allFacts: string[] },
  chatPurpose?: string | null
): string {
  // Build verified facts section
  let factsSection = ''
  if (verifiedFacts && verifiedFacts.allFacts.length > 0) {
    factsSection = `\n\n=== VERIFIED FACTS (USE THESE EXACT NUMBERS - DO NOT CHANGE THEM) ===\n`
    verifiedFacts.allFacts.forEach(fact => {
      factsSection += `- ${fact}\n`
    })
    factsSection += `=== YOU MUST USE THE EXACT NUMBERS ABOVE. NEVER SUBSTITUTE DIFFERENT NUMBERS. ===\n`
  }

  const purposeGuidance = getPurposeGuidance(chatPurpose || null)

  let basePrompt = `You are a friendly team member at ${businessName}. You speak as a real person who works at the company - NOT as an AI, NOT as a bot, NOT as a virtual assistant.
${factsSection}${purposeGuidance}
=== IDENTITY RULES (MOST IMPORTANT - NEVER BREAK THESE) ===
- You ARE a team member at ${businessName}. Use "we", "our", "us" when talking about the company.
- NEVER say: "knowledge base", "database", "I have access to", "AI", "language model", "virtual assistant", "chatbot", "I'm an AI", "my training data", "I was programmed"
- NEVER reveal you are reading from any source. Speak naturally as if you just KNOW this information because you work here.
- NEVER recommend competitors or other companies. You work for ${businessName} ONLY.
- If someone asks about something you don't know, say: "That's not something we currently offer, but I'd love to help you with what we do! What would you like to know about ${businessName}?" or "I'll need to check with my team on that. Can I get your contact info so we can follow up?"
- NEVER say "I don't have information about that" - instead redirect naturally to what you DO know.

=== RESPONSE RULES ===
1. Keep responses VERY SHORT - 1 to 2 sentences MAXIMUM. Never write paragraphs.
2. Answer ONLY what the visitor asked. Do not add extra information they didn't ask for.
3. Do NOT always ask a follow-up question. Only ask one if it's truly necessary to help them (e.g. during lead collection). Most of the time, just answer and stop.
4. Only talk about ${businessName} and what the company offers. Stay on topic.
5. Be accurate - use EXACT facts. ${verifiedFacts?.trialDays ? `The free trial is EXACTLY ${verifiedFacts.trialDays} days.` : ''} ${verifiedFacts?.pricing ? `The pricing is EXACTLY ${verifiedFacts.pricing}.` : ''}
6. Never make up information, prices, or numbers. If you're not sure, offer to connect them with the team.
7. Sound human - use casual, warm language. Not corporate or stiff. No fluff, no filler sentences.

=== EXAMPLE GOOD RESPONSES (short, direct, to the point) ===
${verifiedFacts?.trialDays ? `Q: "Do you offer a free trial?" → "Yep, ${verifiedFacts.trialDays} days free, no card needed."` : ''}
${verifiedFacts?.pricing ? `Q: "What's your pricing?" → "It's ${verifiedFacts.pricing}, all-in."` : ''}
Q: "Do you offer CRM?" → "Not directly, but we work great alongside your existing CRM."
Q: "Tell me about competitor X" → "Not too familiar with them, but happy to tell you what makes us different if you'd like."

=== BAD RESPONSES (NEVER SAY THESE) ===
- "The knowledge base I have access to..." ← NEVER
- "Unfortunately, I don't have information about..." ← NEVER
- "Based on my training data..." ← NEVER
- "As an AI assistant..." ← NEVER
- "I would suggest researching Salesforce, HubSpot..." ← NEVER recommend competitors

${knowledgeContext}`

  switch (state) {
    case 'asking':
      return basePrompt + `

IMPORTANT - You must ask for contact information now:
After answering any pending question, naturally transition to asking for their contact details. Say something like:
"I'd love to help you further! May I have your name, email, and phone number so we can provide you with more detailed information and follow up with you?"

Be friendly and conversational. If they provide all info at once, acknowledge it warmly.`

    case 'collecting_name':
      return basePrompt + `

IMPORTANT - You need to collect the visitor's NAME:
The visitor hasn't provided their name yet. Politely ask for their name. Say something like:
"To better assist you, could you please share your name?"

Be friendly and natural. If they give you their name, thank them and acknowledge it.`

    case 'collecting_email':
      return basePrompt + `

IMPORTANT - You have the visitor's name (${collectedName}), now collect their EMAIL:
Thank them for their name and ask for their email address. Say something like:
"Thanks ${collectedName}! What's your email address so we can follow up with you?"

Be conversational and friendly.`

    case 'collecting_phone':
      return basePrompt + `

IMPORTANT - You have name (${collectedName}) and email (${collectedEmail}), now collect PHONE:
Ask for their phone number to complete the contact information. Say something like:
"Great! And what's the best phone number to reach you at?"

If they provide it, thank them warmly and let them know you've saved their information.`

    case 'complete':
      return basePrompt + `

The visitor has already provided their contact information (Name: ${collectedName}, Email: ${collectedEmail}).
Continue helping them with their questions normally. DO NOT ask for contact information again.`

    case 'declined':
      return basePrompt + `

The visitor declined to provide contact information. That's okay - continue helping them normally.
DO NOT ask for contact information again. Be helpful and professional.`

    default:
      return basePrompt
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, visitorId, conversationId, message, model, chatPurpose } = body

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user and their knowledge base
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { firebaseUid: userId }] },
      include: {
        knowledgeBase: {
          orderBy: { updatedAt: 'desc' },
          take: 10
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please provide a valid userId.' },
        { status: 404, headers: corsHeaders }
      )
    }

    const businessName = user.businessName || 'our company'
    let knowledgeContext = ''

    // Build knowledge base context
    if (user.knowledgeBase.length > 0) {
      knowledgeContext = '\n\nKnowledge Base Information:\n'
      user.knowledgeBase.forEach(kb => {
        knowledgeContext += `\n--- ${kb.title} ---\n${kb.content.substring(0, 2000)}\n`
      })
    }

    // Get or create conversation
    let conversation = null
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 20 },
          lead: true
        }
      })
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          visitorId: visitorId || 'anonymous',
          title: message.substring(0, 50),
          sourcePageUrl: body.sourcePageUrl,
          chatPurpose: chatPurpose || null,
          leadCollectionState: 'normal',
          visitorMessageCount: 0
        },
        include: {
          messages: true,
          lead: true
        }
      })
    }

    // Get current state
    let currentState = (conversation.leadCollectionState || 'normal') as LeadState
    let collectedName = conversation.collectedName
    let collectedEmail = conversation.collectedEmail
    let collectedPhone = conversation.collectedPhone
    let visitorMessageCount = conversation.visitorMessageCount || 0

    // Increment visitor message count
    visitorMessageCount += 1

    // Process the visitor's message based on current state
    const extracted = extractAllInfo(message)

    // Check if user is declining
    if (currentState !== 'normal' && currentState !== 'complete' && currentState !== 'declined') {
      if (isDecline(message)) {
        currentState = 'declined'
      }
    }

    // Handle info extraction based on state
    if (currentState !== 'declined' && currentState !== 'complete') {
      // If they gave email, capture it
      if (extracted.email && !collectedEmail) {
        collectedEmail = extracted.email
      }

      // If they gave phone, capture it
      if (extracted.phone && !collectedPhone) {
        collectedPhone = extracted.phone
      }

      // If they gave name, capture it
      if (extracted.name && !collectedName) {
        collectedName = extracted.name
      }

      // Determine next state based on what we have
      // Lead is complete with just name + email (phone is optional)
      if (currentState === 'asking' || currentState === 'collecting_name' || currentState === 'collecting_email' || currentState === 'collecting_phone') {
        if (collectedName && collectedEmail) {
          currentState = 'complete'
        } else if (collectedName) {
          currentState = 'collecting_email'
        } else if (collectedEmail) {
          currentState = 'collecting_name'
        } else {
          currentState = 'collecting_name'
        }
      }

      // Check if we should trigger lead collection (after 2 visitor messages)
      if (currentState === 'normal' && visitorMessageCount >= 2 && !conversation.lead) {
        currentState = 'asking'
      }
    }

    // If complete, create the lead (name + email required, phone optional)
    let newLead = null
    if (currentState === 'complete' && collectedName && collectedEmail && !conversation.lead) {
      try {
        newLead = await prisma.lead.create({
          data: {
            userId: user.id,
            name: collectedName,
            email: collectedEmail,
            phone: collectedPhone || undefined,
            source: 'chatbot_widget',
            sourcePageUrl: conversation.sourcePageUrl,
            status: 'new',
            conversationSummary: `Collected via proactive lead capture in chat conversation.`
          }
        })
        console.log('Lead created:', newLead.id)

        // Link lead to conversation
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            leadId: newLead.id,
            visitorEmail: collectedEmail
          }
        })

        // Trigger lead analysis and email notification in background (non-blocking)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/leads/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            conversationId: conversation.id,
            messages: [...(conversation.messages || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: 'user', content: message }]
          })
        }).catch(err => console.error('Lead analysis trigger failed:', err))

        // Send email notification to business owner
        fetch(`${appUrl}/api/leads/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: newLead.id })
        }).catch(err => console.error('Lead notification trigger failed:', err))
      } catch (leadError) {
        console.error('Lead creation failed:', leadError)
      }
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message
      }
    })

    // Update conversation state
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        leadCollectionState: currentState,
        collectedName,
        collectedEmail,
        collectedPhone,
        visitorMessageCount
      }
    })

    // Extract verified facts from knowledge base for accuracy
    const verifiedFacts = extractVerifiedFacts(knowledgeContext)

    // Get chatPurpose from conversation or request body
    const effectivePurpose = chatPurpose || conversation.chatPurpose || null

    // Build messages for AI with state-aware and purpose-aware system prompt
    const systemPrompt = getSystemPrompt(
      businessName,
      knowledgeContext,
      currentState,
      collectedName,
      collectedEmail,
      verifiedFacts,
      effectivePurpose
    )

    const previousMessages = conversation?.messages || []
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...previousMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user' as const, content: message }
    ]

    // Get AI response with lower temperature for factual accuracy
    const aiResponse = await sendMessage(chatMessages, model || 'openai/gpt-3.5-turbo', {
      maxTokens: 100,
      temperature: 0.3,
      top_p: 0.9,
      frequency_penalty: 0.5
    })
    let aiMessage = aiResponse.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

    // Post-process: validate and correct any hallucinated facts
    const originalMessage = aiMessage
    aiMessage = validateAIResponse(aiMessage, verifiedFacts)
    if (aiMessage !== originalMessage) {
      console.log('[AI Facts] Response was corrected. Original:', originalMessage, '→ Corrected:', aiMessage)
    }

    // If lead was just created, add a confirmation note to the AI message
    if (newLead && currentState === 'complete') {
      // The AI should already thank them, but we can ensure the message acknowledges the info
      if (!aiMessage.toLowerCase().includes('thank') && !aiMessage.toLowerCase().includes('saved')) {
        aiMessage += "\n\nThank you for sharing your information! I've saved your details and our team will be in touch."
      }
    }

    // Save assistant message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: aiMessage
      }
    })

    return NextResponse.json({
      message: aiMessage,
      conversationId: conversation.id,
      leadCollected: newLead ? true : false,
      state: currentState
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Widget chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500, headers: corsHeaders }
    )
  }
}
