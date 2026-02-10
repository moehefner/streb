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

type AutoPilotActivityRow = {
  id: string
  campaign_id: string | null
  action_type: string
  action_description: string
  created_at: string
  platforms: string[] | null
  result: string | null
  details: Record<string, unknown> | null
}

type JsonObject = Record<string, unknown>

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePlatforms(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

async function getUserRow(clerkUserId: string): Promise<{ data: UserRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single<UserRow>()

  return { data, error }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user
    const { data: userData, error: userError } = await getUserRow(userId)

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 3. Fetch recent activity (last 20), optionally filtered by campaign
    const campaignId = req.nextUrl.searchParams.get('campaign_id')?.trim()

    let query = supabase
      .from('autopilot_activity')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: activities, error: activityError } = await query

    if (activityError) {
      console.error('Activity fetch error:', activityError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch activity'
        },
        { status: 500 }
      )
    }

    // 4. Format activities for display
    const formattedActivities = ((activities || []) as AutoPilotActivityRow[]).map((activity) => ({
      id: activity.id,
      type: activity.action_type,
      action: activity.action_description,
      timestamp: activity.created_at,
      platforms: normalizePlatforms(activity.platforms),
      result: activity.result || 'success',
      details: isRecord(activity.details) ? activity.details : {}
    }))

    // 5. Return activities
    return NextResponse.json({
      success: true,
      activities: formattedActivities
    })
  } catch (error) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activity'
      },
      { status: 500 }
    )
  }
}

// POST - Log new activity (used by n8n workflows)
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = await req.json()
    const actionType = typeof body.actionType === 'string' ? body.actionType.trim() : ''
    const actionDescription =
      typeof body.actionDescription === 'string' ? body.actionDescription.trim() : ''
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''
    const platforms = normalizePlatforms(body.platforms)
    const result = typeof body.result === 'string' && body.result.trim() ? body.result.trim() : 'success'
    const details = isRecord(body.details) ? body.details : {}

    if (!actionType || !actionDescription) {
      return NextResponse.json(
        {
          success: false,
          error: 'actionType and actionDescription are required'
        },
        { status: 400 }
      )
    }

    // 3. Get user
    const { data: userData, error: userError } = await getUserRow(userId)

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 4. Insert activity log
    const payload: Record<string, unknown> = {
      user_id: userData.id,
      action_type: actionType,
      action_description: actionDescription,
      platforms,
      result,
      details
    }

    if (campaignId) {
      payload.campaign_id = campaignId
    }

    const { error: insertError } = await supabase.from('autopilot_activity').insert(payload)

    if (insertError) {
      console.error('Activity log error:', insertError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to log activity'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Activity logged'
    })
  } catch (error) {
    console.error('Log activity error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log activity'
      },
      { status: 500 }
    )
  }
}
