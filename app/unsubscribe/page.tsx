import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

function verifyUnsubscribeToken(token: string): { email: string; campaignId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const [email, campaignId, timestamp, signature] = decoded.split('|')

    if (!email || !campaignId || !timestamp || !signature) {
      return null
    }

    const parsedTimestamp = Number.parseInt(timestamp, 10)
    if (!Number.isFinite(parsedTimestamp)) {
      return null
    }

    // Verify signature
    const payload = `${email}|${campaignId}|${timestamp}`
    const expectedSignature = crypto
      .createHmac('sha256', process.env.UNSUBSCRIBE_SECRET || 'changeme')
      .update(payload)
      .digest('base64url')

    if (signature !== expectedSignature) {
      return null
    }

    // Check if expired (30 days)
    if (Date.now() - parsedTimestamp > 30 * 24 * 60 * 60 * 1000) {
      return null
    }

    return { email, campaignId }
  } catch {
    return null
  }
}

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Invalid Link</h1>
          <p className="text-gray-600">This unsubscribe link is invalid.</p>
        </div>
      </div>
    )
  }

  const verified = verifyUnsubscribeToken(token)

  if (!verified) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Invalid or Expired</h1>
          <p className="text-gray-600">This unsubscribe link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  // Mark as unsubscribed
  await supabase
    .from('outreach_leads')
    .update({
      status: 'unsubscribed',
      email_bounced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('campaign_id', verified.campaignId)
    .ilike('lead_email', verified.email)

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Unsubscribed</h1>
        <p className="text-gray-600">You&apos;ve been unsubscribed from future emails for this campaign.</p>
      </div>
    </div>
  )
}
