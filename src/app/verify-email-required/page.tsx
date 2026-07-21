'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function VerifyEmailRequiredPage() {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const { user } = useAuth()
  const router = useRouter()

  const resendEmail = async () => {
    setSending(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          email: user?.email
        })
      })

      if (response.ok) {
        setMessage('Verification email sent! Please check your inbox.')
      } else {
        setMessage('Failed to send email. Please try again.')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">Email Verification Required</h2>
          <p className="text-gray-600 mb-4">
            Please verify your email address to access the dashboard.
          </p>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              We sent a verification link to:
            </p>
            <p className="font-semibold text-gray-900">{user?.email}</p>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-lg ${message.includes('sent') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="text-sm">{message}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={resendEmail}
              disabled={sending}
              className="w-full"
            >
              {sending ? 'Sending...' : 'Resend Verification Email'}
            </Button>

            <button
              onClick={() => router.push('/login')}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Back to Login
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            Check your spam folder if you don't see the email within a few minutes.
          </p>
        </div>
      </div>
    </div>
  )
}
