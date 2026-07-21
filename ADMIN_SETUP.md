# Admin Setup Guide

Quick guide to create your first admin user after deployment.

## Step 1: Sign Up Normally

1. Go to your deployed app: `https://your-app.vercel.app/signup`
2. Create an account with your email
3. Complete the onboarding process

## Step 2: Make Yourself Admin

Run this command in your terminal (replace the values):

```bash
curl -X POST "https://your-app.vercel.app/api/create-admin?secret=YOUR_ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

**Replace:**
- `your-app.vercel.app` → Your actual Vercel domain
- `YOUR_ADMIN_SECRET_KEY` → Your `ADMIN_SECRET_KEY` from Vercel environment variables
- `your-email@example.com` → The email you signed up with

### Example:

```bash
curl -X POST "https://uplync-ai.vercel.app/api/create-admin?secret=super-secret-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@uplync.io"}'
```

## Step 3: Verify Admin Access

1. Refresh your browser
2. You should now see an "Admin" link in the sidebar (purple badge)
3. Click it to access `/admin/users`

## What You Can Do as Admin

### View All Users

The admin panel shows:
- User email and name
- Onboarding status
- Email verification status
- Current subscription type
- Trial/subscription end dates
- User role

### Manage Subscriptions

For each user, you can set:

1. **Lifetime Free** - No expiration, free forever
2. **Trial (7 days)** - Free trial for 7 days
3. **Paid ($19/month)** - Monthly subscription

Simply select the subscription type from the dropdown, and it will:
- Automatically calculate end dates
- Update subscription status
- Show the new expiration date

### Check Subscription Status

All users are color-coded:
- 🟢 **Active (Green)** - Valid subscription
- 🔴 **Expired (Red)** - Subscription ended
- 🔵 **Trial (Blue)** - In trial period

## Security Notes

### Protect Your Admin Secret

- The `ADMIN_SECRET_KEY` should NEVER be committed to Git
- Only use it once to create the first admin
- After creating your first admin, you can use the admin panel to promote other users
- Consider rotating the secret after initial setup

### Adding More Admins

To add more admin users:

1. Option A: Use the same curl command with a different email
2. Option B: Directly update the database:

```sql
UPDATE User SET role = 'admin' WHERE email = 'another-admin@example.com';
```

## Troubleshooting

### "Unauthorized" Error

- Check that your `ADMIN_SECRET_KEY` matches exactly
- Verify the secret key in Vercel environment variables
- Make sure there are no extra spaces or quotes

### "User not found" Error

- Verify the email address is correct
- Check that you've completed signup and onboarding
- Look in your database to confirm the user exists

### Admin Link Not Showing

1. Clear your browser cache
2. Log out and log back in
3. Check the browser console for errors
4. Verify in the database that `role = 'admin'`

### Can't Access Admin Routes

- Make sure you're logged in
- Verify your user role in the database
- Check that the admin routes exist in your deployment

## Next Steps

After becoming an admin:

1. Test creating another user account
2. Practice changing subscription types
3. Set up the cron job for automatic expiry checks (see DEPLOYMENT.md)
4. Consider setting up email notifications for expiring subscriptions

## API Reference

### Create Admin

```http
POST /api/create-admin?secret=YOUR_SECRET_KEY
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User user@example.com is now an admin",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

### Update Subscription

```http
PUT /api/admin/users/subscription
Content-Type: application/json

{
  "userId": "user-id",
  "subscriptionType": "paid",
  "isLifetimeFree": false
}
```

**Subscription Types:**
- `trial` - 7-day trial
- `paid` - Monthly paid subscription
- `expired` - Manually mark as expired
- Any type with `isLifetimeFree: true` - Lifetime free access

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "123",
    "subscriptionType": "paid",
    "subscriptionStatus": "active",
    "subscriptionEndsAt": "2026-03-06T00:00:00.000Z",
    "isLifetimeFree": false
  }
}
```

### Check Subscriptions (Cron)

```http
GET /api/check-subscriptions
```

or

```http
POST /api/check-subscriptions
```

**Response:**
```json
{
  "success": true,
  "expired": 3,
  "users": [
    {
      "id": "123",
      "email": "user1@example.com",
      "subscriptionEndsAt": "2026-01-20T00:00:00.000Z"
    }
  ]
}
```

This finds all users with `subscriptionEndsAt` in the past and marks them as expired.

## Support

If you encounter any issues:
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions
- Review environment variables in Vercel
- Check Vercel function logs for errors
- Email support@uplync.io for help
