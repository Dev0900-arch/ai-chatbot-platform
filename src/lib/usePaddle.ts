'use client'

import { initializePaddle, Paddle } from '@paddle/paddle-js'
import { useEffect, useState } from 'react'

export default function usePaddle(): Paddle | undefined {
  const [paddle, setPaddle] = useState<Paddle>()

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    if (!token) {
      console.error('[usePaddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN .env me set nahi hai')
      return
    }

    initializePaddle({
      environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as 'sandbox' | 'production') || 'sandbox',
      token,
    }).then((paddleInstance) => {
      if (paddleInstance) setPaddle(paddleInstance)
    })
  }, [])

  return paddle
}
