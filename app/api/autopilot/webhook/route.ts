import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type WebhookAction = 'post' | 'video' | 'outreach'

type UserRow = {
  id: string
  clerk_user_id: string | null
  posts_used: number | null
  posts_limit: number | null
  videos_used: number | null
  videos_limit: number | null
  emails_used: number | null
  emails_limit: number | null
  plan_type: string | null
}

type AutoPilotConfigRow = {
  app_name: string
  app_description: string
  target_audience: string
  key_features: string | null
  app_url: string | null
  github_repo_url: string | null
  platforms: Record<string, boolean> | null
  outreach_platforms: Record<string, boolean> | null
  outreach_keywords: string | null
  min_followers: number | null
  max_results_per_day: number | null
  is_active: boolean | null
  is_paused: boolean | null
}

type ConnectedAccountRow = {
  platform: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}

const POST_PLATFORM_KEYS = new Set([
  'twitter',
  'linkedin',
  'reddit',
  'producthunt',
  'product_hunt',
  'instagram',
  'facebook',
  'threads'
])

const VIDEO_PLATFORM_KEYS = new Set(['tiktok', 'youtube', 'youtube_shorts'])

const OUTREACH_PLATFORM_MAP: Record<string, string> = {
  twitterdm: 'twitter',
  twitter_dm: 'twitter',
  linkedinmessage: 'linkedin',
  linkedin_message: 'linkedin',
  email: 'email'
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

function normalizePlatform(value: string): string {
  return value.trim().toLowerCase()
}

function toNumber(value: number | null, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null
  }

  return token.trim()
}

function isNoRowsError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST116')
}

function getRelevantPlatforms(action: WebhookAction, config: AutoPilotConfigRow): string[] {
  const postPlatforms = toBooleanRecord(config.platforms)
  const outreachPlatforms = toBooleanRecord(config.outreach_platforms)

  if (action === 'post') {
    return Object.entries(postPlatforms)
      .filter(([key, enabled]) => enabled && POST_PLATFORM_KEYS.has(normalizePlatform(key)))
      .map(([key]) => normalizePlatform(key))
  }

  if (action === 'video') {
    return Object.entries(postPlatforms)
      .filter(([key, enabled]) => enabled && VIDEO_PLATFORM_KEYS.has(normalizePlatform(key)))
      .map(([key]) => {
        const normalized = normalizePlatform(key)
        return normalized === 'youtube_shorts' ? 'youtube' : normalized
      })
  }

  return Object.entries(outreachPlatforms)
    .filter(([, enabled]) => enabled)
    .map(([key]) => normalizePlatform(key))
    .map((key) => OUTREACH_PLATFORM_MAP[key] || key)
}

async function findUserByIdOrClerkId(userId: string): Promise<{ data: UserRow | null; error: unknown }> {
  const byId = await supabase
    .from('users')
    .select(
      'id, clerk_user_id, posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit, plan_type'
    )
    .eq('id', userId)
    .single<UserRow>()

  if (!byId.error && byId.data) {
    return { data: byId.data, error: null }
  }

  if (!isNoRowsError(byId.error)) {
    return { data: null, error: byId.error }
  }

  const byClerkId = await supabase
    .from('users')
    .select(
      'id, clerk_user_id, posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit, plan_type'
    )
    .eq('clerk_user_id', userId)
    .single<UserRow>()

  return { data: byClerkId.data ?? null, error: byClerkId.error }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify webhook secret (security)
    const authHeader = req.headers.get('authorization')
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET

    if (!expectedSecret) {
      console.error('N8N_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
    }

    const bearerToken = extractBearerToken(authHeader)
    if (!bearerToken || bearerToken !== expectedSecret) {
      console.error('Unauthorized webhook call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = await req.json()
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const actionRaw = typeof body.action === 'string' ? body.action.trim().toLowerCase() : ''
    const action = actionRaw as WebhookAction

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId is required'
        },
        { status: 400 }
      )
    }

    if (!['post', 'video', 'outreach'].includes(actionRaw)) {
      return NextResponse.json(
        {
          success: false,
          error: 'action must be one of: post, video, outreach'
        },
        { status: 400 }
      )
    }

    console.log(`Webhook triggered: action=${action}, userId=${userId}`)

    // 3. Get user
    const { data: userData, error: userError } = await findUserByIdOrClerkId(userId)

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 4. Check if limits reached
    const postsRemaining = toNumber(userData.posts_limit, 5) - toNumber(userData.posts_used, 0)
    const videosRemaining = toNumber(userData.videos_limit, 3) - toNumber(userData.videos_used, 0)
    const emailsRemaining = toNumber(userData.emails_limit, 25) - toNumber(userData.emails_used, 0)

    if (action === 'post' && postsRemaining <= 0) {
      console.log('Posts limit reached for user:', userData.id)
      return NextResponse.json({
        success: false,
        error: 'Posts limit reached',
        skipAction: true
      })
    }

    if (action === 'video' && videosRemaining <= 0) {
      console.log('Videos limit reached for user:', userData.id)
      return NextResponse.json({
        success: false,
        error: 'Videos limit reached',
        skipAction: true
      })
    }

    if (action === 'outreach' && emailsRemaining <= 0) {
      console.log('Outreach limit reached for user:', userData.id)
      return NextResponse.json({
        success: false,
        error: 'Outreach limit reached',
        skipAction: true
      })
    }

    // 5. Get AutoPilot config
    const { data: config, error: configError } = await supabase
      .from('autopilot_configs')
      .select('*')
      .eq('user_id', userData.id)
      .single<AutoPilotConfigRow>()

    if (configError || !config) {
      if (isNoRowsError(configError) || !config) {
        return NextResponse.json({
          success: false,
          error: 'AutoPilot not configured',
          skipAction: true
        })
      }

      console.error('Failed to fetch AutoPilot config:', configError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch AutoPilot config'
        },
        { status: 500 }
      )
    }

    // Check if paused
    if (config.is_paused || !config.is_active) {
      console.log('AutoPilot is paused/inactive for user:', userData.id)
      return NextResponse.json({
        success: false,
        error: 'AutoPilot is paused or inactive',
        skipAction: true
      })
    }

    // 6. Get connected platforms
    const { data: platforms, error: platformsError } = await supabase
      .from('connected_accounts')
      .select('platform, access_token, refresh_token, token_expires_at')
      .eq('user_id', userData.id)
      .eq('is_active', true)

    if (platformsError) {
      console.error('Failed to fetch platforms:', platformsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch connected platforms'
        },
        { status: 500 }
      )
    }

    // 7. Filter platforms by action type
    const relevantPlatforms = getRelevantPlatforms(action, config)

    const connectedPlatformNames = Array.from(
      new Set(
        ((platforms || []) as ConnectedAccountRow[])
          .map((platform) => platform.platform)
          .filter((platform): platform is string => typeof platform === 'string' && platform.trim().length > 0)
          .map((platform) => normalizePlatform(platform))
      )
    )

    const connectedPlatformSet = new Set(connectedPlatformNames)
    const connectedRelevantPlatforms = relevantPlatforms.filter((platform) =>
      connectedPlatformSet.has(platform)
    )

    if (connectedRelevantPlatforms.length === 0) {
      console.log('No connected platforms for action:', action)
      return NextResponse.json({
        success: false,
        error: `No connected platforms for ${action}`,
        skipAction: true
      })
    }

    // 8. Return config data for n8n to use
    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        clerkUserId: userData.clerk_user_id,
        planType: userData.plan_type
      },
      limits: {
        postsRemaining,
        videosRemaining,
        emailsRemaining
      },
      config: {
        appName: config.app_name,
        appDescription: config.app_description,
        targetAudience: config.target_audience,
        keyFeatures: config.key_features,
        appUrl: config.app_url,
        githubRepoUrl: config.github_repo_url,
        platforms: config.platforms,
        outreachPlatforms: config.outreach_platforms,
        outreachKeywords: config.outreach_keywords,
        minFollowers: config.min_followers,
        maxResultsPerDay: config.max_results_per_day
      },
      connectedPlatforms: connectedRelevantPlatforms
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook failed'
      },
      { status: 500 }
    )
  }
}
