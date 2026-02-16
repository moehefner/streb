import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type TrackRequest = {
  event_type?: string
  platform?: string
  post_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer?: string
  revenue?: number
}

type CampaignRow = {
  id: string
  user_id: string
}

const ALLOWED_EVENT_TYPES = new Set(['click', 'signup', 'conversion'])

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (!xff) {
    return null
  }
  return xff.split(',')[0]?.trim() || null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TrackRequest
    const eventType = typeof body.event_type === 'string' ? body.event_type.trim().toLowerCase() : ''
    const utmCampaign = typeof body.utm_campaign === 'string' ? body.utm_campaign.trim() : ''
    const utmSource = typeof body.utm_source === 'string' ? body.utm_source.trim().toLowerCase() : null
    const utmMedium = typeof body.utm_medium === 'string' ? body.utm_medium.trim().toLowerCase() : null
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : utmSource
    const postId = typeof body.post_id === 'string' && body.post_id.trim().length > 0 ? body.post_id.trim() : null
    const referrer = typeof body.referrer === 'string' && body.referrer.trim().length > 0
      ? body.referrer.trim()
      : req.headers.get('referer')

    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { success: false, error: 'event_type must be one of: click, signup, conversion' },
        { status: 400 }
      )
    }

    if (!utmCampaign) {
      return NextResponse.json(
        { success: false, error: 'utm_campaign is required' },
        { status: 400 }
      )
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('autopilot_configs')
      .select('id, user_id')
      .eq('campaign_name', utmCampaign)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<CampaignRow>()

    if (campaignError) {
      console.error('Analytics campaign lookup error:', campaignError)
      return NextResponse.json({ success: false, error: 'Failed to resolve campaign' }, { status: 500 })
    }

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    const rawRevenue = typeof body.revenue === 'number' && Number.isFinite(body.revenue) ? body.revenue : 0
    const revenueCents = Math.max(0, Math.round(rawRevenue))

    const { error: insertError } = await supabase
      .from('analytics_events')
      .insert({
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        event_type: eventType,
        platform: platform || null,
        post_id: postId,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer: referrer || null,
        ip_address: getClientIp(req),
        user_agent: req.headers.get('user-agent'),
        revenue_cents: revenueCents
      })

    if (insertError) {
      console.error('Analytics insert error:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to track event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics track route error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track event'
      },
      { status: 500 }
    )
  }
}

