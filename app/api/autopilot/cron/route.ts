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
  post_frequency: number | null
  video_frequency: number | null
  outreach_frequency: number | null
  updated_at: string | null
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

function dueActionsForConfig(
  config: AutoPilotCronConfigRow,
  user: UserLimitsRow,
  now: Date
): WorkflowAction[] {
  const elapsedHours = hoursSince(config.updated_at, now)

  const postsRemaining = toNumber(user.posts_limit, 5) - toNumber(user.posts_used, 0)
  const videosRemaining = toNumber(user.videos_limit, 3) - toNumber(user.videos_used, 0)
  const emailsRemaining = toNumber(user.emails_limit, 25) - toNumber(user.emails_used, 0)

  const postDue = elapsedHours >= toNumber(config.post_frequency, 6) && postsRemaining > 0
  const videoDue = elapsedHours >= toNumber(config.video_frequency, 48) && videosRemaining > 0
  const outreachDue = elapsedHours >= toNumber(config.outreach_frequency, 24) && emailsRemaining > 0

  const dueActions: WorkflowAction[] = []
  if (postDue) dueActions.push('post')
  if (videoDue) dueActions.push('video')
  if (outreachDue) dueActions.push('outreach')

  return dueActions
}

async function triggerN8nWorkflow(action: WorkflowAction, userId: string): Promise<TriggerResult> {
  try {
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

    // Trigger n8n webhook
    const response = await fetch(`${baseUrl}/webhook/autopilot/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${n8nSecret}`
      },
      body: JSON.stringify({
        userId,
        action,
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'n8n workflow failed')
      console.error(`n8n workflow failed for ${action}:`, errorText)
      return { success: false, error: errorText || 'n8n workflow failed', status: response.status }
    }

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null)

    return { success: true, status: response.status, data }
  } catch (error) {
    console.error(`Failed to trigger n8n workflow for ${action}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Verify cron secret (security)
    const authHeader = req.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET
    const bearerToken = extractBearerToken(authHeader)

    if (!expectedSecret || bearerToken !== expectedSecret) {
      console.error('Unauthorized cron call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Cron job started:', new Date().toISOString())

    // 2. Get all active AutoPilot configs
    const { data: configs, error: configsError } = await supabase
      .from('autopilot_configs')
      .select(
        'id, user_id, post_frequency, video_frequency, outreach_frequency, updated_at, users!inner(id, clerk_user_id, posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit)'
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
        const result = await triggerN8nWorkflow(action, user.id)
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
