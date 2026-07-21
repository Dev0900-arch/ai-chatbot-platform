import { sendEmail } from './email'

export async function sendVerificationEmail(email: string, token: string, userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verificationUrl = `${baseUrl}/verify-email?token=${token}&userId=${userId}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Verify Your Email</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 24px;">
                    Thank you for signing up for Uplync! To complete your registration and start using your AI chatbot, please verify your email address.
                  </p>

                  <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 24px;">
                    Click the button below to verify your email:
                  </p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${verificationUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 10px; color: #6b7280; font-size: 14px; line-height: 20px;">
                    Or copy and paste this link into your browser:
                  </p>

                  <p style="margin: 0 0 30px; color: #3b82f6; font-size: 14px; line-height: 20px; word-break: break-all;">
                    ${verificationUrl}
                  </p>

                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 30px 0;">
                    <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                      <strong>Important:</strong> This verification link will expire in 24 hours for security purposes.
                    </p>
                  </div>

                  <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                    If you didn't create an account with Uplync, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                    Need help? Contact us at <a href="mailto:support@uplync.io" style="color: #3b82f6; text-decoration: none;">support@uplync.io</a>
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    © 2024 Uplync. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject: 'Verify your email address - Uplync AI Chatbot',
    html
  })
}

// Temporary email domains to block
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'temp-mail.org',
  'getnada.com',
  'yopmail.com',
  'trashmail.com'
]

export function isTempEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return TEMP_EMAIL_DOMAINS.includes(domain)
}
