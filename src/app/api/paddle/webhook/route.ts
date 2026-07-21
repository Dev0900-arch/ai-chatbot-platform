import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(';')
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
  const h1 = parts.find(p => p.startsWith('h1='))?.split('=')[1]
  if (!ts || !h1) return false

  const signedPayload = `${ts}:${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text() // raw text zaroori hai — JSON.parse pehle mat karo
  const signature = request.headers.get('paddle-signature') || ''
  const secret = process.env.PADDLE_WEBHOOK_SECRET

  if (!secret) {
    console.error('[Paddle Webhook] PADDLE_WEBHOOK_SECRET .env me set nahi hai')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const isValid = verifyPaddleSignature(rawBody, signature, secret)
  if (!isValid) {
    console.error('[Paddle Webhook] Invalid signature - request reject kar diya')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventType = event.event_type
  const data = event.data

  console.log(`[Paddle Webhook] Event received: ${eventType}`)

  try {
    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated': {
        const userId = data.custom_data?.userId
        if (userId) {
          await prisma.user.update({
            where: { firebaseUid: userId },
            data: {
              subscriptionType: 'paid',
              subscriptionStatus: 'active',
              paddleCustomerId: data.customer_id,
              paddleSubscriptionId: data.id,
              paddlePriceId: data.items?.[0]?.price?.id,
              subscriptionEndsAt: data.current_billing_period?.ends_at
                ? new Date(data.current_billing_period.ends_at)
                : null,
            },
          })
          console.log(`[Paddle Webhook] User ${userId} ko active kar diya`)
        } else {
          console.error('[Paddle Webhook] custom_data me userId nahi mila — checkout call me customData bhejna check karo')
        }
        break
      }

      case 'subscription.canceled':
      case 'subscription.paused': {
        await prisma.user.updateMany({
          where: { paddleSubscriptionId: data.id },
          data: { subscriptionStatus: 'cancelled' },
        })
        break
      }

      case 'subscription.updated': {
        await prisma.user.updateMany({
          where: { paddleSubscriptionId: data.id },
          data: {
            subscriptionEndsAt: data.current_billing_period?.ends_at
              ? new Date(data.current_billing_period.ends_at)
              : null,
          },
        })
        break
      }

      default:
        // Baaki event types abhi ke liye ignore
        break
    }
  } catch (err) {
    console.error('[Paddle Webhook] Processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
