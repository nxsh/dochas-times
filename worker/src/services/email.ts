export async function sendMagicLinkEmail(
  apiKey: string,
  to: string,
  magicLinkUrl: string
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Dochas Times <onboarding@resend.dev>',
      to: [to],
      subject: 'Sign in to Dochas Times',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h1 style="font-family: 'Georgia', serif; color: #1a5632; font-size: 24px; margin-bottom: 8px;">Dochas Times</h1>
          <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Good news, locally.</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Click the button below to sign in. This link expires in 15 minutes.</p>
          <a href="${magicLinkUrl}" style="display: inline-block; background: #1a5632; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 16px; margin: 24px 0;">Sign in</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #ccc; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">Dochas Times — good news, locally.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Resend error:', res.status, body);
    throw new Error(`Failed to send email: ${res.status}`);
  }
}
