import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type VerificationToken = {
  email: string
  campaignId: string
  userId: string
}

function verifyToken(token: string): VerificationToken | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const [email, campaignId, userId, timestamp, signature] = decoded.split('|')

    if (!email || !campaignId || !userId || !timestamp || !signature) {
      return null
    }

    const payload = `${email}|${campaignId}|${userId}|${timestamp}`
    const expectedSignature = crypto
      .createHmac('sha256', process.env.VERIFICATION_SECRET || 'changeme')
      .update(payload)
      .digest('base64url')

    if (signature !== expectedSignature) {
      return null
    }

    const issuedAt = parseInt(timestamp, 10)
    if (!Number.isFinite(issuedAt)) {
      return null
    }

    if (Date.now() - issuedAt > 24 * 60 * 60 * 1000) {
      return null
    }

    return { email, campaignId, userId }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard?verify=invalid', req.url))
  }

  const verified = verifyToken(token)

  if (!verified) {
    return NextResponse.redirect(new URL('/dashboard?verify=expired', req.url))
  }

  try {
    const { data, error } = await supabase
      .from('autopilot_configs')
      .update({
        outreach_sender_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', verified.campaignId)
      .eq('user_id', verified.userId)
      .eq('outreach_sender_email', verified.email)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.redirect(new URL('/dashboard?verify=invalid', req.url))
    }

    return NextResponse.redirect(new URL('/dashboard?verify=success', req.url))
  } catch (err) {
    console.error('[Verify Sender] Error:', err)
    return NextResponse.redirect(new URL('/dashboard?verify=error', req.url))
  }
}
