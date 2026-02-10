import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserStatusRow = {
  id: string
  posts_used: number | null
  posts_limit: number | null
  videos_used: number | null
  videos_limit: number | null
  emails_used: number | null
  emails_limit: number | null
}

type AutoPilotStatusConfigRow = {
  is_active: boolean | null
  is_paused: boolean | null
  post_frequency: number | null
  video_frequency: number | null
  outreach_frequency: number | null
  updated_at: string | null
}

function toNumber(value: number | null, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000
}

export async function GET(req: NextRequest) {
  try {
    return await getStatusResponse(req)
  } catch (error) {
    console.error('Get status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status'
      },
      { status: 500 }
    )
  }
}

async function getStatusResponse(req?: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user with limits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit')
      .eq('clerk_user_id', userId)
      .single<UserStatusRow>()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 3. Get campaign-specific config (or latest campaign for backward compatibility)
    const campaignId = req?.nextUrl.searchParams.get('campaign_id')?.trim()
    let config: AutoPilotStatusConfigRow | null = null
    let configError: unknown = null

    if (campaignId) {
      const response = await supabase
        .from('autopilot_configs')
        .select('is_active, is_paused, post_frequency, video_frequency, outreach_frequency, updated_at')
        .eq('id', campaignId)
        .eq('user_id', userData.id)
        .maybeSingle<AutoPilotStatusConfigRow>()

      config = response.data
      configError = response.error
    } else {
      const response = await supabase
        .from('autopilot_configs')
        .select('is_active, is_paused, post_frequency, video_frequency, outreach_frequency, updated_at')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<AutoPilotStatusConfigRow>()

      config = response.data
      configError = response.error
    }

    if (configError) {
      console.error('Status config fetch error:', configError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch AutoPilot status'
        },
        { status: 500 }
      )
    }

    if (!config) {
      return NextResponse.json({
        success: true,
        status: {
          isActive: false,
          isPaused: false,
          limitsReached: false,
          nextAction: 'AutoPilot not configured',
          nextActionTime: null
        }
      })
    }

    // 4. Check if limits reached
    const postsUsed = toNumber(userData.posts_used, 0)
    const postsLimit = toNumber(userData.posts_limit, 5)
    const videosUsed = toNumber(userData.videos_used, 0)
    const videosLimit = toNumber(userData.videos_limit, 3)
    const emailsUsed = toNumber(userData.emails_used, 0)
    const emailsLimit = toNumber(userData.emails_limit, 25)

    const limitsReached =
      postsUsed >= postsLimit &&
      videosUsed >= videosLimit &&
      emailsUsed >= emailsLimit

    // 5. Calculate next action time
    let nextAction = ''
    let nextActionTime: string | null = null

    const isActive = Boolean(config.is_active)
    const isPaused = Boolean(config.is_paused)
    const postFrequency = toNumber(config.post_frequency, 6)
    const videoFrequency = toNumber(config.video_frequency, 48)
    const outreachFrequency = toNumber(config.outreach_frequency, 24)

    if (limitsReached) {
      nextAction = 'All limits reached - AutoPilot will resume next month'
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      nextActionTime = nextMonth.toISOString()
    } else if (isPaused) {
      nextAction = 'AutoPilot is paused'
    } else if (isActive) {
      const now = new Date()
      const lastUpdate = config.updated_at ? new Date(config.updated_at) : now
      const baseTime = Number.isNaN(lastUpdate.getTime()) ? now : lastUpdate
      const hoursSinceUpdate = (now.getTime() - baseTime.getTime()) / hoursToMs(1)

      const postDue = hoursSinceUpdate >= postFrequency
      const videoDue = hoursSinceUpdate >= videoFrequency
      const outreachDue = hoursSinceUpdate >= outreachFrequency

      if (postDue) {
        nextAction = 'Creating and posting content'
        nextActionTime = new Date(now.getTime() + 5 * 60 * 1000).toISOString()
      } else if (videoDue) {
        nextAction = 'Creating video'
        nextActionTime = new Date(baseTime.getTime() + hoursToMs(videoFrequency)).toISOString()
      } else if (outreachDue) {
        nextAction = 'Sending outreach messages'
        nextActionTime = new Date(baseTime.getTime() + hoursToMs(outreachFrequency)).toISOString()
      } else {
        const nextPostTime = new Date(baseTime.getTime() + hoursToMs(postFrequency))
        const hoursUntilPost = Math.max(0, (nextPostTime.getTime() - now.getTime()) / hoursToMs(1))
        nextAction = `Creating post in ${Math.round(hoursUntilPost)} hours`
        nextActionTime = nextPostTime.toISOString()
      }
    } else {
      nextAction = 'AutoPilot is inactive'
    }

    // 6. Return status
    return NextResponse.json({
      success: true,
      status: {
        isActive,
        isPaused,
        limitsReached,
        nextAction,
        nextActionTime
      }
    })
  } catch (error) {
    throw error
  }
}
