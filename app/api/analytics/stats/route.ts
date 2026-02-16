import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserRow = {
  id: string
}

type AnalyticsEventRow = {
  event_type: string | null
  platform: string | null
  revenue_cents: number | null
}

type PlatformStats = {
  clicks: number
  signups: number
  conversions: number
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const campaignId = req.nextUrl.searchParams.get('campaign')

    let query = supabase
      .from('analytics_events')
      .select('event_type, platform, revenue_cents')
      .eq('user_id', userData.id)

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: events, error: eventsError } = await query

    if (eventsError) {
      console.error('Analytics stats query error:', eventsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch analytics stats' }, { status: 500 })
    }

    const safeEvents = (events || []) as AnalyticsEventRow[]
    const byPlatform: Record<string, PlatformStats> = {}
    let clicks = 0
    let signups = 0
    let conversions = 0
    let revenueCentsTotal = 0

    for (const event of safeEvents) {
      const type = (event.event_type || '').toLowerCase()
      const platform = (event.platform || 'unknown').toLowerCase()

      if (!byPlatform[platform]) {
        byPlatform[platform] = { clicks: 0, signups: 0, conversions: 0 }
      }

      if (type === 'click') {
        clicks += 1
        byPlatform[platform].clicks += 1
      } else if (type === 'signup') {
        signups += 1
        byPlatform[platform].signups += 1
      } else if (type === 'conversion') {
        conversions += 1
        byPlatform[platform].conversions += 1
      }

      revenueCentsTotal += typeof event.revenue_cents === 'number' ? event.revenue_cents : 0
    }

    return NextResponse.json({
      success: true,
      stats: {
        clicks,
        signups,
        conversions,
        revenue: revenueCentsTotal / 100,
        byPlatform
      }
    })
  } catch (error) {
    console.error('Analytics stats route error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics stats'
      },
      { status: 500 }
    )
  }
}

