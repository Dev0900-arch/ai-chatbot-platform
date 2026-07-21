'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface User {
  id: string
  email: string
  name: string | null
  businessName: string | null
  businessDomain: string | null
  subscriptionType: string
  subscriptionStatus: string
  subscriptionEndsAt: string | null
  isLifetimeFree: boolean
  isOnboarded: boolean
  emailVerified: boolean
  role: string
  createdAt: string
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else if (res.status === 403) {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateSubscription = async (userId: string, type: string, isLifetimeFree: boolean) => {
    try {
      const res = await fetch('/api/admin/users/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscriptionType: type,
          isLifetimeFree
        })
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Subscription updated successfully' })
        fetchUsers()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'Failed to update subscription' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update subscription' })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700'
      case 'expired':
        return 'bg-red-100 text-red-700'
      case 'cancelled':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getSubscriptionBadgeColor = (type: string, isLifetimeFree: boolean) => {
    if (isLifetimeFree) return 'bg-green-100 text-green-700'
    switch (type) {
      case 'trial':
        return 'bg-blue-100 text-blue-700'
      case 'paid':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage user subscriptions and access</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {message.text}
          </p>
        </div>
      )}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-4 text-left text-sm font-semibold text-gray-700">User</th>
                <th className="p-4 text-left text-sm font-semibold text-gray-700">Business</th>
                <th className="p-4 text-left text-sm font-semibold text-gray-700">Subscription</th>
                <th className="p-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="p-4 text-left text-sm font-semibold text-gray-700">Expires</th>
                <th className="p-4 text-left text-sm font-semibold text-gray-700">Verified</th>
                <th className="p-4 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-gray-900">{user.name || user.email}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-gray-900">{user.businessName || '-'}</p>
                      <p className="text-sm text-gray-500">{user.businessDomain || '-'}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      getSubscriptionBadgeColor(user.subscriptionType, user.isLifetimeFree)
                    }`}>
                      {user.isLifetimeFree ? 'LIFETIME FREE' : user.subscriptionType.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      getStatusBadgeColor(user.subscriptionStatus)
                    }`}>
                      {user.subscriptionStatus.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-700">
                      {user.subscriptionEndsAt
                        ? new Date(user.subscriptionEndsAt).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        {user.emailVerified ? (
                          <span className="text-green-600 text-xs flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Email
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Email pending</span>
                        )}
                      </div>
                      <div className="flex items-center">
                        {user.isOnboarded ? (
                          <span className="text-green-600 text-xs flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Setup
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Setup pending</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <select
                      value={user.isLifetimeFree ? 'free' : user.subscriptionType}
                      onChange={(e) => {
                        if (e.target.value === 'free') {
                          updateSubscription(user.id, 'free', true)
                        } else {
                          updateSubscription(user.id, e.target.value, false)
                        }
                      }}
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="free">Lifetime Free</option>
                      <option value="trial">Trial (7 days)</option>
                      <option value="paid">Paid ($19/month)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Subscription Types</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li><strong>Lifetime Free:</strong> Unlimited access, no expiration</li>
          <li><strong>Trial:</strong> 7-day trial period</li>
          <li><strong>Paid:</strong> Monthly subscription ($19/month)</li>
        </ul>
      </div>
    </div>
  )
}
