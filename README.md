# Uplync - AI Chatbot Platform

A complete SaaS platform for AI-powered chatbots with user onboarding, subscription management, email verification, and admin controls.

## Features

### Core Features
- **AI Chatbot Widget**: Embeddable chatbot powered by OpenRouter.ai
- **Knowledge Base**: Manage content that powers your AI responses
- **Lead Management**: Capture and track potential customers
- **Analytics Dashboard**: Monitor chatbot performance and engagement

### SaaS Features
- **User Onboarding**: Mandatory business information collection on first login
- **Subscription Management**: Trial (7 days), Paid ($19/month), and Lifetime Free plans
- **Email Verification**: Beautiful HTML emails with 24-hour token expiration
- **Domain Verification**: Secure widget loading only on authorized domains
- **Admin Panel**: Comprehensive user and subscription management
- **Automated Expiry Checks**: Cron job for subscription status monitoring

## Tech Stack

- **Framework**: Next.js 16.1.5 (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Authentication
- **Database**: MySQL with Prisma ORM
- **AI API**: OpenRouter.ai
- **Email**: Nodemailer with Gmail
- **Deployment**: Vercel with serverless functions

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL database (PlanetScale, Railway, or local)
- Firebase project with Authentication enabled
- OpenRouter.ai API key
- Gmail account for sending emails

### Installation

```bash
# Clone the repository
cd ai-chatbot-platform

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Environment Variables

See [.env.example](./.env.example) for all required variables:

```env
# Database
DATABASE_URL="mysql://..."

# Firebase (Client & Admin SDK)
NEXT_PUBLIC_FIREBASE_API_KEY="..."
FIREBASE_PROJECT_ID="..."
FIREBASE_PRIVATE_KEY="..."

# Email
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-gmail-app-password"

# Admin
ADMIN_SECRET_KEY="your-super-secret-key"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Deployment

### Deploy to Vercel

See comprehensive deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)

Quick steps:
1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy
5. Create first admin user (see below)

### Create First Admin

After deployment, make yourself an admin:

```bash
curl -X POST "https://your-app.vercel.app/api/create-admin?secret=YOUR_ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

See detailed instructions: [ADMIN_SETUP.md](./ADMIN_SETUP.md)

## Project Structure

```
ai-chatbot-platform/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Auth pages (login, signup)
│   │   ├── (dashboard)/         # Dashboard pages (protected)
│   │   ├── onboarding/          # First-time user onboarding
│   │   ├── verify-email/        # Email verification page
│   │   ├── admin/
│   │   │   └── users/           # Admin user management
│   │   └── api/
│   │       ├── auth/            # Authentication endpoints
│   │       ├── user/            # User data & onboarding
│   │       ├── admin/           # Admin operations
│   │       ├── chat/            # Chat API
│   │       ├── widget/          # Widget initialization
│   │       └── create-admin/    # One-time admin creation
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   ├── auth/                # Auth forms
│   │   ├── dashboard/           # Sidebar, Header
│   │   └── chat/                # Chat widget
│   ├── lib/
│   │   ├── firebase.ts          # Firebase client config
│   │   ├── firebase-admin.ts    # Firebase admin SDK
│   │   ├── prisma.ts            # Prisma client
│   │   ├── auth-context.tsx     # Auth context provider
│   │   ├── email-verification.ts # Email utilities
│   │   └── email.ts             # Email sending
│   └── types/                   # TypeScript types
├── prisma/
│   └── schema.prisma            # Database schema
├── public/
│   ├── widget.js                # Embeddable chat widget
│   └── UPlynclogo.png           # Logo
├── DEPLOYMENT.md                # Comprehensive deployment guide
├── ADMIN_SETUP.md               # Admin user creation guide
└── vercel.json                  # Vercel config with cron jobs
```

## User Flow

### 1. Signup & Onboarding
- User signs up with email/password
- Redirected to mandatory onboarding page
- Collects: Business name, domain, industry, phone
- Automatically assigned 7-day trial
- Sends email verification

### 2. Email Verification
- User receives beautiful HTML email
- 24-hour token expiration
- Can resend if expired
- Yellow reminder banner until verified

### 3. Dashboard Access
- Access to Dashboard, Chat, Leads, Analytics, Settings
- Route protection ensures onboarding is complete
- Subscription status checked on every page load

### 4. Subscription Expiry
- Cron job runs daily to check expirations
- Expired users see blocking modal with contact info
- Can still view dashboard but interaction is limited

## Admin Features

Admin users can:

- **View All Users**: Email, name, role, onboarding status, verification status
- **Manage Subscriptions**: Change type (Trial/Paid/Lifetime Free)
- **Track Expirations**: See trial and subscription end dates
- **Monitor Status**: Active/Expired indicators

Access admin panel at: `/admin/users`

## API Routes

### Authentication
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/verify-email` - Verify email token

### User Management
- `GET /api/user?firebaseUid=XXX` - Get user data
- `POST /api/user/onboarding` - Complete onboarding
- `POST /api/user/resend-verification` - Resend verification email

### Admin Operations
- `POST /api/create-admin?secret=XXX` - Create first admin (one-time)
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/subscription` - Update subscription

### Subscription Management
- `GET|POST /api/check-subscriptions` - Check for expired subscriptions (cron)

### Chat & Widget
- `POST /api/chat` - Send message to AI
- `POST /api/widget/init` - Initialize widget with domain verification
- `POST /api/widget/chat` - Widget chat endpoint

## Database Schema

Key models:

### User
```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  firebaseUid         String?   @unique
  role                String    @default("user")

  // Onboarding
  isOnboarded         Boolean   @default(false)
  businessName        String?
  businessDomain      String?
  registeredDomain    String?
  industry            String?
  phoneNumber         String?

  // Email verification
  emailVerified       Boolean   @default(false)
  verificationToken   String?
  verificationSentAt  DateTime?

  // Subscription
  subscriptionType    String    @default("trial")
  subscriptionStatus  String    @default("active")
  trialEndsAt         DateTime?
  subscriptionEndsAt  DateTime?
  isLifetimeFree      Boolean   @default(false)

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### Additional Models
- **Conversation**: Chat sessions
- **Message**: Individual messages
- **Lead**: Captured leads
- **KnowledgeBase**: AI training content

## Subscription Types

### Trial (Default)
- 7-day free trial
- Automatically assigned on onboarding
- Full access to all features

### Paid
- $19/month subscription
- Manual renewal by admin (Stripe integration planned)
- Full access to all features

### Lifetime Free
- No expiration
- Granted by admin only
- Full access to all features

### Expired
- Subscription past end date
- Shows blocking modal with contact information
- Limited dashboard access

## Scripts

```bash
# Development
npm run dev              # Start dev server on :3000
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio

# Prisma commands
npx prisma generate      # Generate client
npx prisma db push       # Push schema
npx prisma studio        # Open Studio
npx prisma migrate dev   # Create migration
```

## Security Features

### Domain Verification
- Widget only loads on authorized domains
- Normalizes domains (removes www, case-insensitive)
- Allows localhost and Vercel previews for testing

### Email Verification
- Blocks temporary email domains
- 24-hour token expiration
- One-time use tokens

### Admin Access
- Secret key required for first admin creation
- Role-based access control
- Admin routes should add middleware (future)

### Route Protection
- Non-authenticated users redirected to login
- Non-onboarded users redirected to onboarding
- Subscription status checked on each page load

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) - Admin user creation guide
- [.env.example](./.env.example) - Environment variables template

## Troubleshooting

### Common Issues

**Email verification not sending**
- Check Gmail App Password is correct
- Verify 2FA is enabled on Gmail
- Check Vercel logs for email errors

**Widget not loading**
- Verify domain matches `registeredDomain` in database
- Check browser console for errors
- Ensure domain normalization (www, case)

**Admin link not showing**
- Verify `role = 'admin'` in database
- Try logging out and back in
- Clear browser cache

**Subscription status not updating**
- Verify cron job is configured in vercel.json
- Manually call `/api/check-subscriptions`
- Check database `subscriptionEndsAt` dates

See [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting) for more details.

## Future Enhancements

### Planned Features
- **Stripe Integration**: Automated payment processing
- **Email Reminders**: Expiry warnings 3 days before
- **Usage Analytics**: Track API calls per user
- **Admin Middleware**: Protect admin routes with role checking
- **User Self-Service**: Allow users to manage their own subscriptions
- **Webhooks**: Stripe webhooks for automated subscription updates
- **Multi-language Support**: Internationalization for global users

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Email**: support@uplync.io
- **Issues**: [GitHub Issues](https://github.com/your-org/uplync/issues)
- **Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

## License

MIT License - see LICENSE file for details

---

Built with ❤️ using Next.js, Firebase, and OpenRouter.ai
