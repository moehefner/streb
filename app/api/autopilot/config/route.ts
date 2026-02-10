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

type AutoPilotConfigRow = {
  id: string
  campaign_name: string | null
  app_name: string
  app_description: string
  target_audience: string
  key_features: string | null
  app_url: string | null
  github_repo_url: string | null
  post_frequency: number | null
  video_frequency: number | null
  outreach_frequency: number | null
  platforms: Record<string, boolean> | null
  outreach_platforms: Record<string, boolean> | null
  outreach_keywords: string | null
  min_followers: number | null
  max_results_per_day: number | null
  is_active: boolean | null
  is_paused: boolean | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toBooleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {}
  }

  const normalized: Record<string, boolean> = {}
  for (const [key, raw] of Object.entries(value)) {
    normalized[key] = Boolean(raw)
  }
  return normalized
}

function toPositiveInt(value: unknown, fallback: number, min = 0): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  const rounded = Math.floor(numeric)
  return rounded < min ? min : rounded
}

async function getUserRow(clerkUserId: string): Promise<{ data: UserRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single<UserRow>()

  return { data, error }
}

// GET - Fetch AutoPilot config
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

    // 3. Fetch campaign-specific config (or latest campaign for backward compatibility)
    const campaignId = req.nextUrl.searchParams.get('campaign_id')?.trim()

    let config: AutoPilotConfigRow | null = null
    let configError: unknown = null

    if (campaignId) {
      const response = await supabase
        .from('autopilot_configs')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', userData.id)
        .maybeSingle<AutoPilotConfigRow>()

      config = response.data
      configError = response.error
    } else {
      const response = await supabase
        .from('autopilot_configs')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<AutoPilotConfigRow>()

      config = response.data
      configError = response.error
    }

    if (configError) {
      console.error('Get AutoPilot config DB error:', configError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch AutoPilot config'
        },
        { status: 500 }
      )
    }

    if (!config) {
      return NextResponse.json({
        success: true,
        config: null
      })
    }

    // 4. Return config
    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        campaignName: config.campaign_name || config.app_name,
        appName: config.app_name,
        appDescription: config.app_description,
        targetAudience: config.target_audience,
        keyFeatures: config.key_features || '',
        appUrl: config.app_url || '',
        githubRepoUrl: config.github_repo_url || '',
        postFrequency: config.post_frequency ?? 6,
        videoFrequency: config.video_frequency ?? 48,
        outreachFrequency: config.outreach_frequency ?? 24,
        platforms: config.platforms || {},
        outreachPlatforms: config.outreach_platforms || {},
        outreachKeywords: config.outreach_keywords || '',
        minFollowers: config.min_followers ?? 100,
        maxResultsPerDay: config.max_results_per_day ?? 25,
        isActive: config.is_active ?? true,
        isPaused: config.is_paused ?? false
      }
    })
  } catch (error) {
    console.error('Get AutoPilot config error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch config'
      },
      { status: 500 }
    )
  }
}

// POST - Save AutoPilot config
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = await req.json()
    const campaignName = typeof body.campaignName === 'string' ? body.campaignName.trim() : ''
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''
    const appName = typeof body.appName === 'string' ? body.appName.trim() : ''
    const appDescription = typeof body.appDescription === 'string' ? body.appDescription.trim() : ''
    const targetAudience = typeof body.targetAudience === 'string' ? body.targetAudience.trim() : ''
    const keyFeatures = typeof body.keyFeatures === 'string' ? body.keyFeatures.trim() : ''
    const appUrl = typeof body.appUrl === 'string' ? body.appUrl.trim() : ''
    const githubRepoUrl = typeof body.githubRepoUrl === 'string' ? body.githubRepoUrl.trim() : ''
    const outreachKeywords =
      typeof body.outreachKeywords === 'string' ? body.outreachKeywords.trim() : ''

    const postFrequency = toPositiveInt(body.postFrequency, 6, 1)
    const videoFrequency = toPositiveInt(body.videoFrequency, 48, 1)
    const outreachFrequency = toPositiveInt(body.outreachFrequency, 24, 1)
    const minFollowers = toPositiveInt(body.minFollowers, 100, 0)
    const maxResultsPerDay = toPositiveInt(body.maxResultsPerDay, 25, 1)

    const platforms = toBooleanRecord(body.platforms)
    const outreachPlatforms = toBooleanRecord(body.outreachPlatforms)

    // 3. Validate required fields
    if (!appName || !appDescription || !targetAudience) {
      return NextResponse.json(
        {
          success: false,
          error: 'App name, description, and target audience are required'
        },
        { status: 400 }
      )
    }

    if (appDescription.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'App description must be at least 100 characters'
        },
        { status: 400 }
      )
    }

    // 4. Get user
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

    const resolvedCampaignName = campaignName || appName

    // 5. Upsert config (insert or update)
    const { data: config, error: configError } = await supabase
      .from('autopilot_configs')
      .upsert(
        {
          id: campaignId || undefined,
          user_id: userData.id,
          campaign_name: resolvedCampaignName,
          app_name: appName,
          app_description: appDescription,
          target_audience: targetAudience,
          key_features: keyFeatures || null,
          app_url: appUrl || null,
          github_repo_url: githubRepoUrl || null,
          post_frequency: postFrequency,
          video_frequency: videoFrequency,
          outreach_frequency: outreachFrequency,
          platforms,
          outreach_platforms: outreachPlatforms,
          outreach_keywords: outreachKeywords || null,
          min_followers: minFollowers,
          max_results_per_day: maxResultsPerDay,
          is_active: true,
          is_paused: false,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id,campaign_name'
        }
      )
      .select('id, campaign_name, is_active, is_paused')
      .single<{ id: string; campaign_name: string | null; is_active: boolean; is_paused: boolean }>()

    if (configError || !config) {
      console.error('Config save error:', configError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save AutoPilot config'
        },
        { status: 500 }
      )
    }

    console.log('AutoPilot config saved for user:', userData.id)

    // 6. Return success
    return NextResponse.json({
      success: true,
      message: 'AutoPilot configuration saved and activated',
      config: {
        id: config.id,
        campaignName: config.campaign_name || resolvedCampaignName,
        isActive: config.is_active,
        isPaused: config.is_paused
      }
    })
  } catch (error) {
    console.error('Save AutoPilot config error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save config'
      },
      { status: 500 }
    )
  }
}
