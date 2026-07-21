'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'
import Button from '@/components/ui/Button'
import usePaddle from '@/lib/usePaddle'

interface UserData {
  isOnboarded: boolean
  emailVerified: boolean
  subscriptionType: string
  subscriptionStatus: string
  subscriptionEndsAt: string | null
  isLifetimeFree: boolean
  role: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const paddle = usePaddle()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  const openUpgradeCheckout = (priceId: string) => {
    if (!paddle || !user || !user.email) return
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: user.uid },
      settings: { successUrl: `${window.location.origin}/dashboard?upgraded=true` },
    })
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user?.uid) {
      fetchUserData()
    }
  }, [user?.uid])

  const fetchUserData = async () => {
    try {
      const res = await fetch(`/api/user?firebaseUid=${user?.uid}`)
      if (res.ok) {
        const data = await res.json()
        setUserData({
          isOnboarded: data.isOnboarded,
          emailVerified: data.emailVerified,
          subscriptionType: data.subscriptionType,
          subscriptionStatus: data.subscriptionStatus,
          subscriptionEndsAt: data.subscriptionEndsAt,
          isLifetimeFree: data.isLifetimeFree,
          role: data.role
        })

        // Route protection: Check email verification first
        if (!data.emailVerified) {
          router.push('/verify-email-required')
          return
        }

        // Route protection: Redirect if not onboarded (unless already on onboarding page)
        if (!data.isOnboarded && !pathname?.includes('/onboarding')) {
          router.push('/onboarding')
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setIsLoadingUser(false)
    }
  }

  const calculateDaysLeft = (endDate: string) => {
    const now = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  if (loading || isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Trial Banner */}
        {userData && userData.subscriptionType === 'trial' && userData.subscriptionEndsAt && userData.subscriptionStatus === 'active' && (
          <div className="bg-blue-600 text-white px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">&#9200;</span>
                <div>
                  <p className="font-semibold text-sm">
                    Free Trial: {calculateDaysLeft(userData.subscriptionEndsAt)} days remaining
                  </p>
                  <p className="text-xs text-blue-100">
                    Upgrade to continue using Uplync after your trial ends
                  </p>
                </div>
              </div>
              <a
                href="mailto:support@uplync.io?subject=Upgrade to Paid Plan"
                className="bg-white text-blue-600 px-4 py-1.5 rounded-lg font-semibold text-sm hover:bg-blue-50 whitespace-nowrap"
              >
                Upgrade Now - $19/month
              </a>
            </div>
          </div>
        )}

        {/* Lifetime Free Banner */}
        {userData && userData.isLifetimeFree && (
          <div className="bg-green-600 text-white px-6 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <span className="text-xl">&#127881;</span>
              <p className="font-semibold text-sm">
                Lifetime Free Access - Enjoy unlimited access to all features!
              </p>
            </div>
          </div>
        )}

        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Subscription Expired Modal */}
      {userData?.subscriptionStatus === 'expired' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Expired</h2>
              <p className="text-gray-600 mb-6">
                Your subscription has expired. Please contact us to renew your plan and continue using Uplync.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Contact Us to Renew:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>support@uplync.io</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>WhatsApp: +1 (234) 567-8900</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => openUpgradeCheckout(process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY!)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Monthly
                </Button>
                <Button
                  onClick={() => openUpgradeCheckout(process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY!)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Yearly
                </Button>
              </div>
              <Button
                onClick={() => window.location.href = 'mailto:support@uplync.io?subject=Subscription Renewal Request'}
                className="w-full"
                variant="outline"
              >
                Contact Support
              </Button>
              <button
                onClick={() => router.push('/settings')}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                View Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
