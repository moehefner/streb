import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ResendEventData = {
  to?: string | string[]
}

type ResendEvent = {
  type?: string
  data?: ResendEventData
}

type LeadRow = {
  id: string
  status: string | null
  user_id: string
  campaign_id: string
}

function getRecipientEmail(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value.trim().toLowerCase()
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    return typeof first === 'string' ? first.trim().toLowerCase() : ''
  }

  return ''
}

async function checkAndPauseIfNeeded(userId: string, campaignId: string): Promise<void> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const threshold = thirtyDaysAgo.toISOString()

  // Get total sent
  const { count: totalSent } = await supabase
    .from('outreach_leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .eq('status', 'sent')
    .gte('email_sent_at', threshold)

  if (!totalSent || totalSent === 0) return

  // Get bounced only
  const { count: bounced } = await supabase
    .from('outreach_leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .eq('status', 'bounced')
    .gte('email_bounced_at', threshold)

  // Get unsubscribed (complaints)
  const { count: complained } = await supabase
    .from('outreach_leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .eq('status', 'unsubscribed')
    .gte('email_bounced_at', threshold)

  const bounceRate = (bounced || 0) / totalSent
  const complaintRate = (complained || 0) / totalSent

  let pauseReason: string | null = null

  // Check complaint rate first (stricter threshold)
  if (complaintRate > 0.001) {
    pauseReason = `High complaint rate: ${(complaintRate * 100).toFixed(2)}% (threshold: 0.1%)`
  } else if (bounceRate > 0.1) {
    pauseReason = `High bounce rate: ${(bounceRate * 100).toFixed(1)}% (threshold: 10%)`
  }

  if (pauseReason) {
    console.log(`[Resend Webhook] Pausing campaign: ${pauseReason}`)

    await supabase
      .from('autopilot_configs')
      .update({
        is_paused: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    await supabase.from('autopilot_activity').insert({
      user_id: userId,
      campaign_id: campaignId,
      action_type: 'outreach',
      action_description: 'Campaign auto-paused',
      platforms: ['email'],
      result: 'paused',
      details: {
        reason: pauseReason,
        bounceRate,
        complaintRate
      }
    })

    // TODO: Send alert email to user
  }
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET not configured' }, { status: 500 })
    }

    const payload = await req.text()
    const headers = {
      'svix-id': req.headers.get('svix-id') || '',
      'svix-timestamp': req.headers.get('svix-timestamp') || '',
      'svix-signature': req.headers.get('svix-signature') || ''
    }

    const wh = new Webhook(webhookSecret)
    const event = wh.verify(payload, headers) as ResendEvent

    const type = typeof event?.type === 'string' ? event.type : ''
    const email = getRecipientEmail(event?.data?.to)

    if (!email) {
      return NextResponse.json({ received: true, note: 'recipient not found in payload' })
    }

    const { data: leads, error: leadError } = await supabase
      .from('outreach_leads')
      .select('id, status, user_id, campaign_id')
      .eq('lead_email', email)
      .order('created_at', { ascending: false })
      .limit(1)

    if (leadError) {
      console.error('[Resend Webhook] Lead lookup failed:', leadError)
      return NextResponse.json({ error: 'Lead lookup failed' }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ received: true, note: 'lead not found' })
    }

    const lead = leads[0] as LeadRow
    const nowIso = new Date().toISOString()
    const updates: Record<string, unknown> = { updated_at: nowIso }

    switch (type) {
      case 'email.delivered':
        updates.status = 'delivered'
        updates.email_delivered_at = nowIso
        break
      case 'email.opened':
        updates.status = 'opened'
        updates.email_opened_at = nowIso
        break
      case 'email.clicked':
        updates.status = 'clicked'
        updates.email_clicked_at = nowIso
        break
      case 'email.bounced':
        updates.status = 'bounced'
        updates.email_bounced_at = nowIso
        break
      case 'email.complained':
      case 'email.complaint':
      case 'email.unsubscribed':
        updates.status = 'unsubscribed'
        updates.email_bounced_at = nowIso
        break
      default:
        return NextResponse.json({ received: true, note: `ignored event type: ${type || 'unknown'}` })
    }

    const { error: updateError } = await supabase.from('outreach_leads').update(updates).eq('id', lead.id)

    if (updateError) {
      console.error('[Resend Webhook] Lead update failed:', updateError)
      return NextResponse.json({ error: 'Lead update failed' }, { status: 500 })
    }

    if (type === 'email.bounced' || type === 'email.complained' || type === 'email.complaint' || type === 'email.unsubscribed') {
      await checkAndPauseIfNeeded(lead.user_id, lead.campaign_id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Resend Webhook] Error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
