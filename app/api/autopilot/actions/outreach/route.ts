import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import Stripe from 'stripe'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' })
  : null

type WebhookActionRequest = {
  userId?: string
  campaignId?: string
}

type UserRow = {
  id: string
  clerk_user_id: string | null
  emails_used: number | null
  emails_limit: number | null
  plan_type: string | null
  stripe_subscription_id: string | null
}

type ConfigRow = {
  id: string
  campaign_name: string | null
  app_name: string
  app_description: string
  target_audience: string
  outreach_keywords: string | null
  max_results_per_day: number | null
  is_active: boolean | null
  is_paused: boolean | null
  outreach_sender_email: string | null
  outreach_sender_verified: boolean | null
}

type EmailLead = {
  name: string
  email: string
  title: string
  company: string
  linkedinUrl: string
}

type SkipReason =
  | 'monthly_limit_reached'
  | 'daily_budget_reached'
  | 'unverified_sender'
  | 'campaign_not_eligible'

type Counters = {
  emails_used: number
  emails_limit: number
  sentCount: number
  failedCount: number
}

function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim()
  }

  return authHeader.trim()
}

function isNoRowsError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST116'
  )
}

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getKeywords(input: string | null): string[] {
  if (!input) {
    return []
  }

  return input
    .split('\n')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
}

function buildCounters(user: UserRow, sentCount = 0, failedCount = 0, emailsUsedOverride?: number): Counters {
  return {
    emails_used: typeof emailsUsedOverride === 'number' ? emailsUsedOverride : toNumber(user.emails_used, 0),
    emails_limit: toNumber(user.emails_limit, 25),
    sentCount,
    failedCount
  }
}

function generateUnsubscribeToken(email: string, campaignId: string): string {
  const payload = `${email}|${campaignId}|${Date.now()}`
  const signature = crypto
    .createHmac('sha256', process.env.UNSUBSCRIBE_SECRET || 'changeme')
    .update(payload)
    .digest('base64url')

  return Buffer.from(`${payload}|${signature}`).toString('base64url')
}

function successSkipResponse(user: UserRow, reason: SkipReason, status = 200) {
  return NextResponse.json(
    {
      success: true,
      skipAction: true,
      reason,
      counters: buildCounters(user)
    },
    { status }
  )
}

async function findUserByIdOrClerkId(userId: string): Promise<UserRow | null> {
  const byId = await supabase
    .from('users')
    .select('id, clerk_user_id, emails_used, emails_limit, plan_type, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle<UserRow>()

  if (byId.data) {
    return byId.data
  }

  if (byId.error && !isNoRowsError(byId.error)) {
    throw byId.error
  }

  const byClerkId = await supabase
    .from('users')
    .select('id, clerk_user_id, emails_used, emails_limit, plan_type, stripe_subscription_id')
    .eq('clerk_user_id', userId)
    .maybeSingle<UserRow>()

  if (byClerkId.error && !isNoRowsError(byClerkId.error)) {
    throw byClerkId.error
  }

  return byClerkId.data || null
}

async function findCampaign(userDbId: string, campaignId?: string): Promise<ConfigRow | null> {
  let query = supabase.from('autopilot_configs').select('*').eq('user_id', userDbId).eq('is_active', true)

  if (campaignId) {
    query = query.eq('id', campaignId)
  } else {
    query = query.order('created_at', { ascending: false }).limit(1)
  }

  const { data, error } = await query.maybeSingle<ConfigRow>()
  if (error && !isNoRowsError(error)) {
    throw error
  }

  return data || null
}

async function getBillingCycleEnd(userId: string): Promise<Date> {
  const { data: user, error } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .single<{ stripe_subscription_id: string | null }>()

  if (error) {
    logger.warn('Outreach Billing Cycle', 'Failed to fetch stripe_subscription_id, using calendar month', {
      userId,
      error
    })
  }

  if (user?.stripe_subscription_id && stripeClient) {
    try {
      const subscription = await stripeClient.subscriptions.retrieve(user.stripe_subscription_id)
      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
      if (typeof periodEnd === 'number' && Number.isFinite(periodEnd)) {
        return new Date(periodEnd * 1000)
      }
    } catch (err) {
      logger.warn('Outreach Billing Cycle', 'Stripe lookup failed, using calendar month', {
        userId,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
}

async function computeSendBudget(
  user: UserRow,
  config: ConfigRow
): Promise<{
  send_now: number
  reason: SkipReason | null
}> {
  const now = new Date()

  const remaining_monthly = Math.max(0, toNumber(user.emails_limit, 25) - toNumber(user.emails_used, 0))
  if (remaining_monthly === 0) {
    return { send_now: 0, reason: 'monthly_limit_reached' }
  }

  const billingCycleEnd = await getBillingCycleEnd(user.id)
  const msPerDay = 24 * 60 * 60 * 1000
  const days_left = Math.max(1, Math.ceil((billingCycleEnd.getTime() - now.getTime()) / msPerDay))
  const daily_budget = Math.ceil(remaining_monthly / days_left)

  const today_start = new Date(now)
  today_start.setHours(0, 0, 0, 0)

  const { count: sent_today, error: sentTodayError } = await supabase
    .from('outreach_leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('email_sent_at', today_start.toISOString())

  const sentToday = sentTodayError ? 0 : sent_today || 0
  if (sentTodayError) {
    logger.warn('Outreach Budget', 'Failed to count sent_today from outreach_leads, defaulting to 0', {
      userId: user.id,
      error: sentTodayError
    })
  }

  const remaining_today = Math.max(0, daily_budget - sentToday)
  if (remaining_today === 0) {
    return { send_now: 0, reason: 'daily_budget_reached' }
  }

  const end_of_day = new Date(now)
  end_of_day.setHours(23, 59, 59, 999)
  const cron_interval_hours = 1
  const runs_left_today = Math.max(
    1,
    Math.ceil((end_of_day.getTime() - now.getTime()) / (cron_interval_hours * 60 * 60 * 1000))
  )

  const run_budget = Math.ceil(remaining_today / runs_left_today)
  const config_max = config?.max_results_per_day ?? 25
  const send_now = Math.min(run_budget, config_max, remaining_monthly)

  return { send_now, reason: null }
}

async function findEmailLeads(
  baseUrl: string,
  keyword: string,
  webhookSecret: string,
  perPage: number
): Promise<EmailLead[]> {
  const response = await fetch(`${baseUrl}/api/outreach/find-leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${webhookSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      keywords: keyword,
      jobTitles: ['founder', 'ceo', 'product manager'],
      minEmployees: 1,
      perPage: Math.max(1, Math.min(perPage, 100))
    })
  })

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    leads?: EmailLead[]
    error?: string
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Lead lookup failed with status ${response.status}`)
  }

  return Array.isArray(payload.leads) ? payload.leads : []
}

async function buildEmailBody(config: ConfigRow, lead: EmailLead): Promise<string> {
  const emailPrompt = `Write a personalized cold email to ${lead.name}, ${lead.title} at ${lead.company}.

Our app: ${config.app_name} - ${config.app_description}
Target audience: ${config.target_audience}

The email should:
- Reference their role/company
- Explain how our app solves their problem
- Be under 100 words
- Include clear CTA
- Sound natural, not salesy

Return ONLY the email body.`

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: emailPrompt
      }
    ]
  })

  if (response.content[0]?.type !== 'text') {
    return `Hi ${lead.name}, quick question: would ${config.app_name} help ${lead.company} with ${config.target_audience.toLowerCase()} workflows? Open to a short chat this week?`
  }

  return response.content[0].text.trim()
}

async function sendResendEmail(
  resendApiKey: string,
  fromAddress: string,
  lead: EmailLead,
  emailBody: string,
  emailSubject: string,
  tags: Array<{ name: string; value: string }>
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress,
      to: lead.email,
      subject: emailSubject,
      text: emailBody,
      tags
    })
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string
      error?: string
    }

    return {
      success: false,
      error: payload.message || payload.error || `Resend failed with status ${response.status}`
    }
  }

  return { success: true }
}

async function isEmailSuppressed(userId: string, campaignId: string, email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('outreach_leads')
    .select('id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .eq('lead_email', email)
    .in('status', ['bounced', 'unsubscribed'])
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (error && !isNoRowsError(error)) {
    logger.warn('Outreach Suppression', 'Suppression lookup failed, defaulting to not suppressed', {
      userId,
      campaignId,
      email,
      error
    })
    return false
  }

  return Boolean(data)
}

export async function POST(req: NextRequest) {
  let requestUserId = ''
  let requestCampaignId = ''

  try {
    const authHeader = req.headers.get('authorization')
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET

    if (!webhookSecret) {
      return NextResponse.json({ success: false, error: 'N8N_WEBHOOK_SECRET not configured' }, { status: 500 })
    }

    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
    }

    if (token !== webhookSecret) {
      return NextResponse.json({ success: false, error: 'Invalid webhook secret' }, { status: 401 })
    }

    const body = (await req.json()) as WebhookActionRequest
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''
    requestUserId = userId
    requestCampaignId = campaignId

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const userData = await findUserByIdOrClerkId(userId)
    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const config = await findCampaign(userData.id, campaignId || undefined)
    if (!config || config.is_active === false || config.is_paused) {
      return successSkipResponse(userData, 'campaign_not_eligible')
    }

    if (!config.outreach_sender_verified) {
      return successSkipResponse(userData, 'unverified_sender')
    }

    const budget = await computeSendBudget(userData, config)
    if (budget.send_now === 0 && budget.reason) {
      await supabase.from('autopilot_activity').insert({
        user_id: userData.id,
        campaign_id: config.id,
        action_type: 'outreach',
        action_description: `Skipped - ${budget.reason}`,
        result: 'skipped',
        details: {
          reason: budget.reason,
          emails_used: toNumber(userData.emails_used, 0),
          emails_limit: toNumber(userData.emails_limit, 25),
          plan: userData.plan_type || 'free'
        }
      })

      return successSkipResponse(userData, budget.reason)
    }

    const keywords = getKeywords(config.outreach_keywords)
    if (keywords.length === 0) {
      return NextResponse.json({
        success: true,
        skipAction: true,
        reason: null,
        counters: buildCounters(userData)
      })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ success: false, error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }

    const keyword = keywords[0]
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const emailLeads = await findEmailLeads(baseUrl, keyword, webhookSecret, budget.send_now)
    const selectedLeads = emailLeads.slice(0, budget.send_now)

    if (selectedLeads.length === 0) {
      return NextResponse.json({
        success: true,
        skipAction: true,
        reason: null,
        counters: buildCounters(userData)
      })
    }

    let sentCount = 0
    let failedCount = 0
    const sendErrors: string[] = []

    // Sender email is mandatory - verification check already passed above
    const fromEmail = config.outreach_sender_email!
    const fromAddress = `${config.app_name} <${fromEmail}>`
    const emailDelayMs = Math.max(
      0,
      toNumber(process.env.OUTREACH_EMAIL_DELAY_MS ? Number(process.env.OUTREACH_EMAIL_DELAY_MS) : 60000, 60000)
    )

    for (let i = 0; i < selectedLeads.length; i += 1) {
      const lead = selectedLeads[i]

      // Check if already contacted in any successful state
      const { data: alreadyContacted, error: alreadyContactedError } = await supabase
        .from('outreach_leads')
        .select('id')
        .eq('user_id', userData.id)
        .eq('campaign_id', config.id)
        .ilike('lead_email', lead.email)
        .in('status', ['sent', 'delivered', 'opened', 'clicked', 'replied', 'converted'])
        .limit(1)
        .maybeSingle<{ id: string }>()

      if (alreadyContactedError && !isNoRowsError(alreadyContactedError)) {
        logger.warn('Outreach Dedup', 'Already-contacted lookup failed; continuing', {
          userId: userData.id,
          campaignId: config.id,
          email: lead.email,
          error: alreadyContactedError
        })
      }

      if (alreadyContacted) {
        const { error: skipLogError } = await supabase.from('outreach_leads').insert({
          user_id: userData.id,
          campaign_id: config.id,
          source_platform: 'apollo',
          post_id: `skip_${Date.now()}_${i}`,
          post_title: 'Already contacted',
          post_link: '#',
          post_author: lead.name || 'unknown',
          lead_email: lead.email,
          status: 'discovered',
          skip_reason: 'already_contacted'
        })

        if (skipLogError) {
          logger.warn('Outreach Dedup', 'Failed to persist already-contacted skip log', {
            userId: userData.id,
            campaignId: config.id,
            email: lead.email,
            error: skipLogError
          })
        }

        failedCount += 1
        sendErrors.push(`email:${lead.email}: already_contacted`)
        continue
      }

      const suppressed = await isEmailSuppressed(userData.id, config.id, lead.email)

      if (suppressed) {
        const { error: skipLogError } = await supabase.from('outreach_leads').insert({
          user_id: userData.id,
          campaign_id: config.id,
          source_platform: 'apollo',
          post_id: `skip_${Date.now()}_${i}`,
          post_title: 'Suppressed',
          post_link: '#',
          post_author: lead.name || 'unknown',
          lead_email: lead.email,
          status: 'discovered',
          skip_reason: 'suppressed_recipient'
        })

        if (skipLogError) {
          logger.warn('Outreach Suppression', 'Failed to persist suppressed recipient skip log', {
            userId: userData.id,
            campaignId: config.id,
            email: lead.email,
            error: skipLogError
          })
        }

        failedCount += 1
        sendErrors.push(`email:${lead.email}: suppressed_recipient`)
        continue
      }

      const emailBody = await buildEmailBody(config, lead)
      const unsubscribeToken = generateUnsubscribeToken(lead.email, config.id)
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || baseUrl}/unsubscribe?token=${unsubscribeToken}`

      const emailBodyWithFooter = `${emailBody}

---

Unsubscribe: ${unsubscribeUrl}

Streb AutoPilot on behalf of ${config.app_name}
`

      const emailSubject = `Quick question about ${lead.company || 'your'} workflow`
      const sendResult = await sendResendEmail(resendApiKey, fromAddress, lead, emailBodyWithFooter, emailSubject, [
        { name: 'campaign_id', value: config.id },
        { name: 'channel', value: 'outreach' },
        { name: 'source', value: 'autopilot' }
      ])

      if (sendResult.success) {
        const nowIso = new Date().toISOString()
        const { error: leadInsertError } = await supabase.from('outreach_leads').insert({
          user_id: userData.id,
          campaign_id: config.id,

          // Source
          source_platform: 'apollo',
          source_name: 'email_discovery',
          post_id: `email_${Date.now()}_${i}`,
          post_title: keyword || 'keyword search',
          post_content: `Lead from Apollo: ${lead.company || 'unknown company'}`,
          post_link: lead.linkedinUrl || '#',
          post_author: lead.name || 'unknown',
          post_published_at: nowIso,

          // Identity
          identity_anchors: {
            company: lead.company || null,
            linkedin_url: lead.linkedinUrl || null,
            person_name: lead.name || null
          },

          // Enrichment
          lead_email: lead.email,
          lead_name: lead.name || null,
          lead_company: lead.company || null,
          lead_linkedin: lead.linkedinUrl || null,

          // Email
          email_subject: emailSubject,
          email_body: emailBodyWithFooter,
          email_sent_from: fromEmail,

          // Status
          status: 'sent',
          email_sent_at: nowIso,

          // Metadata
          matched_keywords: keywords
        })

        if (leadInsertError) {
          throw leadInsertError
        }

        sentCount += 1
      } else {
        failedCount += 1
        if (sendResult.error) {
          sendErrors.push(`email:${lead.email}: ${sendResult.error}`)
        }
      }

      if (emailDelayMs > 0 && i < selectedLeads.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, emailDelayMs))
      }
    }

    const description = `Sent ${sentCount} outreach emails`
    const { error: activityError } = await supabase.from('autopilot_activity').insert({
      user_id: userData.id,
      campaign_id: config.id,
      action_type: 'outreach',
      action_description: description,
      platforms: ['email'],
      result: sentCount > 0 ? 'success' : 'failed',
      details: {
        keyword,
        leadsFound: emailLeads.length,
        sent: sentCount,
        failed: failedCount,
        errors: sendErrors.slice(0, 10)
      }
    })

    if (activityError) {
      throw activityError
    }

    const currentEmailsUsed = toNumber(userData.emails_used, 0)
    const newEmailsUsed = currentEmailsUsed + sentCount
    const { error: usageError } = await supabase
      .from('users')
      .update({
        emails_used: newEmailsUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id)

    if (usageError) {
      throw usageError
    }

    const { error: timestampError } = await supabase
      .from('autopilot_configs')
      .update({ last_outreach_at: new Date().toISOString() })
      .eq('id', config.id)

    if (timestampError) {
      throw timestampError
    }

    return NextResponse.json({
      success: true,
      skipAction: false,
      reason: null,
      counters: buildCounters(userData, sentCount, failedCount, newEmailsUsed)
    })
  } catch (error) {
    logger.error('AutoPilot Outreach', error, {
      userId: requestUserId || null,
      campaignId: requestCampaignId || null,
      platforms: ['email']
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute outreach action'
      },
      { status: 500 }
    )
  }
}
