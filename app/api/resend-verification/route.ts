import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserRow = {
  id: string
}

type CampaignRow = {
  id: string
  user_id: string
  outreach_sender_email: string | null
  outreach_sender_verified: boolean | null
  app_name: string | null
}

function generateVerificationToken(email: string, campaignId: string, userId: string): string {
  const payload = `${email}|${campaignId}|${userId}|${Date.now()}`
  const signature = crypto
    .createHmac('sha256', process.env.VERIFICATION_SECRET || 'changeme')
    .update(payload)
    .digest('base64url')

  return Buffer.from(`${payload}|${signature}`).toString('base64url')
}

async function getUserByClerkId(clerkUserId: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle<UserRow>()

  if (error) {
    throw error
  }

  return data || null
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { campaignId?: unknown }
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const user = await getUserByClerkId(clerkUserId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('autopilot_configs')
      .select('id, user_id, outreach_sender_email, outreach_sender_verified, app_name')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .maybeSingle<CampaignRow>()

    if (campaignError) {
      throw campaignError
    }

    if (!campaign || !campaign.outreach_sender_email) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.outreach_sender_verified) {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 })
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const { count, error: rateLimitError } = await supabase
      .from('autopilot_activity')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('campaign_id', campaignId)
      .eq('action_type', 'resend_verification')
      .gte('created_at', oneHourAgo.toISOString())

    if (rateLimitError) {
      throw rateLimitError
    }

    if (count && count >= 3) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }

    const token = generateVerificationToken(campaign.outreach_sender_email, campaign.id, campaign.user_id)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const verifyUrl = `${appUrl}/api/verify-sender?token=${token}`

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }

    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Streb <noreply@streb.ai>',
        to: campaign.outreach_sender_email,
        subject: 'Verify your outreach sender email',
        text: `Click to verify your email for ${campaign.app_name || 'your campaign'}:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`
      })
    })

    if (!sendResponse.ok) {
      const errorBody = await sendResponse.text().catch(() => '')
      return NextResponse.json(
        { error: `Failed to send verification email (${sendResponse.status})`, details: errorBody || null },
        { status: 502 }
      )
    }

    await supabase.from('autopilot_activity').insert({
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      action_type: 'resend_verification',
      action_description: 'Resent verification email',
      result: 'success',
      details: { to: campaign.outreach_sender_email }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Resend Verification] Error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}

