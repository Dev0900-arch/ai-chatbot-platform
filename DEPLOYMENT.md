# Deployment Guide - Uplync AI Chatbot Platform

This guide covers deploying the complete SaaS platform with onboarding, subscription management, and admin features.

## Prerequisites

- Vercel account
- MySQL database (PlanetScale, Railway, or similar)
- Firebase project with Authentication enabled
- Gmail account for sending verification emails

## Environment Variables

Add these to your Vercel project settings:

```env
# Database
DATABASE_URL="mysql://username:password@host:port/database"

# Firebase Admin SDK
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@your-project.iam.gserviceaccount.com"

# Firebase Client Config
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Email Configuration (Gmail)
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Admin Secret (generate a random string)
ADMIN_SECRET_KEY="your-super-secret-admin-key-change-this"

# App URL
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

## Deployment Steps

### 1. Push to GitHub

Your code is already committed. Push to GitHub:

```bash
git push origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Add all environment variables listed above
5. Click "Deploy"

### 3. Push Database Schema

After deployment, the Prisma schema will be automatically applied. To manually push:

```bash
npx prisma db push
```

### 4. Create First Admin User

After deploying, create your first admin user:

1. Sign up normally through the UI at `https://your-app.vercel.app/signup`
2. Complete the onboarding process
3. Use this API call to make yourself admin:

```bash
curl -X POST "https://your-app.vercel.app/api/create-admin?secret=YOUR_ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

Replace:
- `YOUR_ADMIN_SECRET_KEY` with your actual `ADMIN_SECRET_KEY` from environment variables
- `your-email@example.com` with the email you signed up with

4. Refresh the page - you should now see the Admin link in the sidebar

## Gmail App Password Setup

For email verification to work, you need a Gmail App Password:

1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled
3. Go to Security > 2-Step Verification > App passwords
4. Generate a new app password for "Mail"
5. Use this 16-character password as `EMAIL_PASS` in environment variables

## Setting Up Subscription Expiry Checks

To automatically check for expired subscriptions, set up a Vercel Cron Job:

### Option 1: Vercel Cron (Recommended)

1. Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/check-subscriptions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs daily at midnight UTC.

### Option 2: External Cron Service

Use a service like cron-job.org to ping:
```
https://your-app.vercel.app/api/check-subscriptions
```

## Post-Deployment Testing

### Test the Complete User Flow

1. **Signup & Onboarding**
   - Go to `/signup`
   - Create an account
   - Verify you're redirected to `/onboarding`
   - Fill in all business information
   - Verify you're redirected to `/dashboard`

2. **Email Verification**
   - Check that you see the yellow verification reminder
   - Click "Resend verification email"
   - Check your inbox for the verification email
   - Click the verification link
   - Verify the reminder disappears

3. **Domain Verification (Widget)**
   - Copy your widget embed code from dashboard
   - Test on a page matching your registered domain
   - Test on localhost (should work)
   - Test on Vercel preview (should work)
   - Test on different domain (should show error)

4. **Admin Panel**
   - Make yourself admin using the curl command above
   - Refresh and verify "Admin" link appears in sidebar
   - Click Admin link to view `/admin/users`
   - View all users and their subscription status
   - Test changing a user's subscription type

5. **Subscription Management**
   - View a user in admin panel
   - Change their subscription to "Lifetime Free"
   - Verify `subscriptionEndsAt` is null
   - Change to "Trial"
   - Verify `subscriptionEndsAt` is 7 days from now
   - Change to "Paid"
   - Verify `subscriptionEndsAt` is 30 days from now

6. **Subscription Expiry**
   - Create a test user with expired subscription
   - Login as that user
   - Verify the subscription expired modal appears
   - Verify dashboard is still accessible but modal blocks interaction

## Subscription Types

### Trial (Default)
- 7-day trial period
- Assigned automatically on onboarding
- `trialEndsAt` and `subscriptionEndsAt` set to 7 days
- Status: `active`

### Paid
- $19/month subscription
- `subscriptionEndsAt` set to 30 days from activation
- Must be renewed monthly (manually by admin for now)
- Status: `active`

### Lifetime Free
- No expiration date
- `isLifetimeFree: true`
- `subscriptionEndsAt: null`
- Status: `active`

### Expired
- Any subscription past `subscriptionEndsAt`
- Automatically detected by cron job
- Modal shown to user with contact information
- User can still access dashboard but sees blocking modal

## Admin Capabilities

As an admin, you can:

1. **View All Users**
   - Email, name, role
   - Onboarding status
   - Email verification status
   - Subscription type and status
   - Trial/subscription end dates

2. **Manage Subscriptions**
   - Change any user's subscription type
   - Grant lifetime free access
   - Extend trials
   - Mark as paid

3. **Future Enhancements** (not yet implemented)
   - Payment integration (Stripe)
   - Automated subscription renewal
   - Usage analytics per user
   - Billing history

## Security Notes

### Important Security Measures

1. **ADMIN_SECRET_KEY**
   - Keep this completely secret
   - Never commit to Git
   - Use a long, random string (50+ characters)
   - Only use it once to create the first admin

2. **Email Verification**
   - Temporary email domains are blocked
   - Tokens expire after 24 hours
   - Tokens are deleted after successful verification

3. **Domain Verification**
   - Widget only works on registered domains
   - Localhost and Vercel previews allowed for testing
   - Case-insensitive and www-prefix handled

4. **Route Protection**
   - Non-onboarded users redirected to onboarding
   - Non-authenticated users redirected to login
   - Admin routes should add role checking (future enhancement)

## Troubleshooting

### Email Verification Not Sending

1. Check Gmail App Password is correct
2. Verify `EMAIL_USER` and `EMAIL_PASS` in Vercel environment variables
3. Check Vercel logs for email errors
4. Ensure 2FA is enabled on Gmail account

### Widget Not Loading

1. Check browser console for errors
2. Verify `registeredDomain` in database matches actual domain
3. Check domain normalization (removes www, lowercase)
4. Verify Firebase credentials are correct

### Admin Link Not Showing

1. Verify user role is set to 'admin' in database
2. Check browser console for API errors
3. Try logging out and back in
4. Verify `/api/user?firebaseUid=XXX` returns correct role

### Subscription Status Not Updating

1. Verify cron job is running
2. Manually call `/api/check-subscriptions`
3. Check database `subscriptionEndsAt` dates
4. Verify `isLifetimeFree` is false for expired users

## Next Steps

Consider implementing:

1. **Stripe Integration**
   - Automated payment collection
   - Webhook for subscription events
   - Automatic renewal

2. **Admin Role Protection**
   - Middleware to verify admin role
   - Protect `/api/admin/*` routes

3. **Email Templates**
   - Subscription expiry warnings (3 days before)
   - Trial ending reminders
   - Welcome emails

4. **Analytics Dashboard**
   - Total users count
   - Active subscriptions
   - Revenue tracking
   - Conversion rates

5. **User Self-Service**
   - Allow users to upgrade/downgrade
   - Payment method management
   - Invoice history

## Support

For issues or questions:
- Email: support@uplync.io
- GitHub Issues: [Your repo URL]
- Documentation: [Your docs URL]
