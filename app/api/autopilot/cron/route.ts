import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type WorkflowAction = 'post' | 'video' | 'outreach'

type UserLimitsRow = {
  id: string
  clerk_user_id: string | null
  posts_used: number | null
  posts_limit: number | null
  videos_used: number | null
  videos_limit: number | null
  emails_used: number | null
  emails_limit: number | null
}

type AutoPilotCronConfigRow = {
  id: string
  user_id: string
  post_frequency: number | string | null
  video_frequency: number | string | null
  outreach_frequency: number | string | null
  last_post_at: string | null
  last_video_at: string | null
  last_outreach_at: string | null
  platforms: unknown
  outreach_platforms: unknown
  users: unknown
}

type TriggerResult = {
  success: boolean
  error?: string
  status?: number
  data?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function looksLikeUserLimitsRow(value: unknown): value is UserLimitsRow {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.id === 'string'
}

function normalizeJoinedUser(value: unknown): UserLimitsRow | null {
  if (Array.isArray(value)) {
    const match = value.find((entry) => looksLikeUserLimitsRow(entry))
    return match ?? null
  }

  return looksLikeUserLimitsRow(value) ? value : null
}

function toBooleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {}
  }

  const result: Record<string, boolean> = {}
  for (const [key, raw] of Object.entries(value)) {
    result[key] = Boolean(raw)
  }

  return result
}

function normalizePlatformId(value: string): string {
  return value.trim().toLowerCase()
}

function getEnabledPlatformIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map(normalizePlatformId)
      .filter((entry) => entry.length > 0)
  }

  const normalized = toBooleanRecord(value)
  return Object.entries(normalized)
    .filter(([, enabled]) => enabled)
    .map(([key]) => normalizePlatformId(key))
    .filter((entry) => entry.length > 0)
}

function hasAnyEnabledPlatformInSet(platforms: unknown, allowed: Set<string>): boolean {
  const enabled = getEnabledPlatformIds(platforms)
  return enabled.some((platform) => allowed.has(platform))
}

function hasAnyEnabledPlatform(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  const normalized = toBooleanRecord(value)
  return Object.values(normalized).some(Boolean)
}

function isOutreachEnabled(config: AutoPilotCronConfigRow): boolean {
  const normalized = toBooleanRecord(config.outreach_platforms)
  const keys = Object.keys(normalized)

  if (keys.length === 0) {
    return true
  }

  if (typeof normalized.email === 'boolean') {
    return normalized.email
  }

  return Object.values(normalized).some(Boolean)
}

function resolveIntervalHours(
  action: WorkflowAction,
  frequency: number | string | null | undefined
): number {
  if (typeof frequency === 'number' && Number.isFinite(frequency) && frequency > 0) {
    return frequency
  }

  if (typeof frequency === 'string') {
    const normalized = frequency.trim().toLowerCase()

    if (action === 'post') {
      if (normalized === 'twice_daily') return 12
      if (normalized === 'daily') return 24
      if (normalized === 'every_6_hours') return 6
    }

    if (action === 'video') {
      if (normalized === 'daily') return 24
      if (normalized === 'every_2_days') return 48
      if (normalized === 'every_3_days') return 72
      if (normalized === 'weekly') return 168
    }

    if (action === 'outreach') {
      if (normalized === 'daily') return 24
      if (normalized === 'every_2_days') return 48
      if (normalized === 'weekly') return 168
    }

    const asNumber = Number(normalized)
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber
    }
  }

  if (action === 'post') return 6
  if (action === 'video') return 48
  return 24
}

function hoursSince(timestamp: string | null, now: Date): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY
  }

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return Number.POSITIVE_INFINITY
  }

  return (now.getTime() - parsed.getTime()) / (1000 * 60 * 60)
}

function isDueForAction(config: AutoPilotCronConfigRow, action: WorkflowAction, now: Date): boolean {
  const POST_PLATFORMS = new Set(['twitter', 'linkedin', 'facebook', 'instagram'])
  const VIDEO_PLATFORMS = new Set(['twitter', 'instagram', 'facebook', 'tiktok', 'youtube', 'youtube_shorts'])

  // Check if action has relevant platforms enabled to reduce noisy triggers.
  if (action === 'post' && !hasAnyEnabledPlatformInSet(config.platforms, POST_PLATFORMS)) {
    return false
  }

  if (action === 'video' && !hasAnyEnabledPlatformInSet(config.platforms, VIDEO_PLATFORMS)) {
    return false
  }

  if (action === 'outreach') {
    const normalizedOutreach = toBooleanRecord(config.outreach_platforms)
    const hasAnyKeys = Object.keys(normalizedOutreach).length > 0

    // Backward compatible:
    // - If outreach_platforms is empty/missing, treat outreach as enabled.
    // - If email key exists, it must be true.
    if (hasAnyKeys && 'email' in normalizedOutreach && !normalizedOutreach.email) {
      return false
    }
  }

  let lastRun: string | null = null
  let frequency: number | string | null | undefined = null

  if (action === 'post') {
    lastRun = config.last_post_at
    frequency = config.post_frequency
  } else if (action === 'video') {
    lastRun = config.last_video_at
    frequency = config.video_frequency
  } else {
    lastRun = config.last_outreach_at
    frequency = config.outreach_frequency
  }

  if (!lastRun) {
    return true
  }

  const intervalHours = resolveIntervalHours(action, frequency)
  const elapsedHours = hoursSince(lastRun, now)
  return elapsedHours >= intervalHours
}

function dueActionsForConfig(config: AutoPilotCronConfigRow, user: UserLimitsRow, now: Date): WorkflowAction[] {
  const postsRemaining = toNumber(user.posts_limit, 5) - toNumber(user.posts_used, 0)
  const videosRemaining = toNumber(user.videos_limit, 3) - toNumber(user.videos_used, 0)
  const emailsRemaining = toNumber(user.emails_limit, 25) - toNumber(user.emails_used, 0)

  const dueActions: WorkflowAction[] = []

  if (postsRemaining > 0 && hasAnyEnabledPlatform(config.platforms) && isDueForAction(config, 'post', now)) {
    dueActions.push('post')
  }

  if (videosRemaining > 0 && hasAnyEnabledPlatform(config.platforms) && isDueForAction(config, 'video', now)) {
    dueActions.push('video')
  }

  if (emailsRemaining > 0 && isOutreachEnabled(config) && isDueForAction(config, 'outreach', now)) {
    dueActions.push('outreach')
  }

  return dueActions
}

async function triggerN8nWorkflow(
  action: WorkflowAction,
  userId: string,
  campaignId: string
): Promise<TriggerResult> {
  const n8nUrl = process.env.N8N_WEBHOOK_URL
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET

  if (!n8nUrl) {
    console.error('N8N_WEBHOOK_URL not configured')
    return { success: false, error: 'N8N URL not configured' }
  }

  if (!n8nSecret) {
    console.error('N8N_WEBHOOK_SECRET not configured')
    return { success: false, error: 'N8N webhook secret not configured' }
  }

  const baseUrl = n8nUrl.replace(/\/+$/, '')
  const webhookUrl = `${baseUrl}/webhook/autopilot/${action}?userId=${encodeURIComponent(userId)}&campaignId=${encodeURIComponent(campaignId)}`

  console.log(`[Cron] Triggering n8n workflow: ${action} for user ${userId}`)

  try {
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${n8nSecret}`
      }
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null)

    console.log(`[Cron] n8n response for ${action}:`, data)

    return {
      success: response.ok,
      status: response.status,
      data
    }
  } catch (error) {
    console.error(`[Cron] Failed to trigger ${action}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log('[Cron] Starting AutoPilot cron job...')
    
    // 1. Authenticate
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    console.log('[Cron] Auth header present:', !!authHeader)
    console.log('[Cron] CRON_SECRET configured:', !!cronSecret)

    if (!cronSecret) {
      console.error('[Cron] CRON_SECRET not set in environment')
      return NextResponse.json({
        error: 'Server configuration error',
        details: 'CRON_SECRET not configured'
      }, { status: 500 })
    }

    if (!authHeader) {
      console.error('[Cron] No Authorization header provided')
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'Missing Authorization header'
      }, { status: 401 })
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader

    console.log('[Cron] Token extracted:', token.substring(0, 10) + '...')
    console.log('[Cron] Expected secret:', cronSecret.substring(0, 10) + '...')

    if (token !== cronSecret) {
      console.error('[Cron] Invalid token provided')
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'Invalid CRON_SECRET'
      }, { status: 401 })
    }

    console.log('[Cron] ✅ Authentication successful')
    console.log('Cron job started:', new Date().toISOString())

    // 2. Get all active AutoPilot configs
    const { data: configs, error: configsError } = await supabase
      .from('autopilot_configs')
      .select(
        'id, user_id, post_frequency, video_frequency, outreach_frequency, last_post_at, last_video_at, last_outreach_at, platforms, outreach_platforms, users!inner(id, clerk_user_id, posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit)'
      )
      .eq('is_active', true)
      .eq('is_paused', false)

    if (configsError) {
      console.error('Failed to fetch configs:', configsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch configs'
        },
        { status: 500 }
      )
    }

    const configRows = (configs || []) as AutoPilotCronConfigRow[]

    if (configRows.length === 0) {
      console.log('No active AutoPilot configs found')
      return NextResponse.json({
        success: true,
        message: 'No active AutoPilot configs',
        triggered: 0,
        results: []
      })
    }

    console.log(`Found ${configRows.length} active AutoPilot configs`)

    // 3. For each config, check what's due
    const now = new Date()
    let triggeredCount = 0
    const results: Array<{ userId: string; action: WorkflowAction; result: TriggerResult }> = []

    for (const config of configRows) {
      const user = normalizeJoinedUser(config.users)
      if (!user) {
        console.error('Skipping config with invalid joined user:', config.id)
        continue
      }

      const dueActions = dueActionsForConfig(config, user, now)

      for (const action of dueActions) {
        console.log(`Triggering ${action} workflow for user ${user.id}`)
        const result = await triggerN8nWorkflow(action, user.id, config.id)
        results.push({ userId: user.id, action, result })
        triggeredCount++
      }
    }

    console.log(`Cron job complete. Triggered ${triggeredCount} workflows.`)

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggeredCount} workflows`,
      triggered: triggeredCount,
      results
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron job failed'
      },
      { status: 500 }
    )
  }
}
