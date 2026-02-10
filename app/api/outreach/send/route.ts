import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY || '')

const SEND_INTERVAL_MS = Number(process.env.OUTREACH_SEND_INTERVAL_MS || 60000)

type UserRow = {
  id: string
  emails_used: number | null
  emails_limit: number | null
  plan_type: string | null
}

type ConnectedAccountRow = {
  access_token: string | null
  platform: string
}

type LeadMessage = {
  subject?: string
  body: string
}

type LeadInput = {
  id?: string
  platform?: string
  name?: string
  email?: string
  handle?: string
  participantId?: string
  platformUserId?: string
  recipientId?: string
  message?: LeadMessage
}

type SendFrom = {
  name?: string
  email?: string
}

type RequestBody = {
  campaignName?: string
  leads?: LeadInput[]
  appName?: string
  appDescription?: string
  sendFrom?: SendFrom
}

type SendResult = {
  success: boolean
  messageId?: string
  error?: string
}

type ResultEntry = {
  success: boolean
  sentAt?: string
  messageId?: string
  error?: string
}

function sanitizeInterval(value: number): number {
  if (!Number.isFinite(value) || value < 1000) {
    return 60000
  }
  return Math.floor(value)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isValidLead(lead: LeadInput): lead is LeadInput & {
  platform: string
  name: string
  message: LeadMessage
} {
  return (
    !!lead.platform &&
    !!lead.name &&
    !!lead.message &&
    typeof lead.message.body === 'string' &&
    lead.message.body.trim().length > 0
  )
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatFromHeader(sendFrom: SendFrom | undefined): string | null {
  const name = sendFrom?.name?.trim()
  const email = sendFrom?.email?.trim()
  if (!name || !email) return null
  return `${name} <${email}>`
}

function getLeadKey(lead: LeadInput, index: number): string {
  return lead.id?.trim() || `lead-${index + 1}`
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = (await req.json()) as RequestBody
    const {
      campaignName = `Outreach Campaign ${new Date().toISOString()}`,
      leads = [],
      appName = 'your product',
      appDescription,
      sendFrom
    } = body

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one lead is required'
        },
        { status: 400 }
      )
    }

    const invalidLead = leads.find((lead) => !isValidLead(lead))
    if (invalidLead) {
      return NextResponse.json(
        {
          success: false,
          error: 'Each lead must include platform, name, and message.body'
        },
        { status: 400 }
      )
    }

    // 3. Get user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, emails_used, emails_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 4. Check limits BEFORE sending
    const emailsUsed = userData.emails_used ?? 0
    const emailsLimit = userData.emails_limit ?? 0
    const totalToSend = leads.length
    const remaining = Math.max(0, emailsLimit - emailsUsed)

    if (totalToSend > remaining) {
      return NextResponse.json(
        {
          success: false,
          error: `You can only send ${remaining} more messages this month. You selected ${totalToSend} leads.`,
          upgradeRequired: true,
          currentPlan: userData.plan_type ?? 'free',
          emailsUsed,
          emailsLimit
        },
        { status: 403 }
      )
    }

    console.log(`Sending to ${totalToSend} leads for campaign: ${campaignName}`)

    // 5. Create campaign record
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userData.id,
        name: campaignName,
        platform: leads[0]?.platform || null,
        total_leads: totalToSend,
        status: 'sending',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Campaign creation error:', campaignError)
    }

    const campaignId = (campaignData as { id?: string } | null)?.id || null

    // 6. Send to each lead
    const results: Record<string, ResultEntry> = {}
    let successCount = 0
    let failureCount = 0
    const intervalMs = sanitizeInterval(SEND_INTERVAL_MS)

    for (let index = 0; index < leads.length; index++) {
      const lead = leads[index]
      const leadKey = getLeadKey(lead, index)

      try {
        console.log(`Sending to ${lead.name} via ${lead.platform}`)

        let sendResult: SendResult

        if (lead.platform === 'twitter' || lead.platform === 'linkedin') {
          sendResult = await sendDM(lead, userData.id)
        } else {
          sendResult = await sendEmail(lead, sendFrom, appName)
        }

        if (sendResult.success) {
          successCount++
          results[leadKey] = {
            success: true,
            sentAt: new Date().toISOString(),
            messageId: sendResult.messageId
          }
        } else {
          failureCount++
          results[leadKey] = {
            success: false,
            error: sendResult.error || 'Send failed'
          }
        }

        // 1 message per minute between sends to reduce spam-detection risk
        if (index < leads.length - 1) {
          console.log(`Rate limiting: waiting ${intervalMs}ms...`)
          await delay(intervalMs)
        }
      } catch (error) {
        console.error(`Failed to send to ${lead.name}:`, error)
        failureCount++
        results[leadKey] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // 7. Increment usage counter (successful sends only)
    const newEmailsUsed = emailsUsed + successCount
    const { error: usageUpdateError } = await supabase
      .from('users')
      .update({
        emails_used: newEmailsUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id)

    if (usageUpdateError) {
      console.error('Failed to update emails_used:', usageUpdateError)
    }

    // 8. Update campaign status
    if (campaignId) {
      const finalStatus = successCount > 0 ? 'completed' : 'failed'
      const { error: campaignUpdateError } = await supabase
        .from('campaigns')
        .update({
          sent_count: successCount,
          failed_count: failureCount,
          status: finalStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      if (campaignUpdateError) {
        console.error('Failed to update campaign:', campaignUpdateError)
      }
    }

    // 9. Save outreach records
    const outreachRecords = leads.map((lead, index) => {
      const leadKey = getLeadKey(lead, index)
      const result = results[leadKey]
      return {
        user_id: userData.id,
        campaign_id: campaignId,
        lead_name: lead.name || null,
        lead_email: lead.email || lead.handle || null,
        platform: lead.platform || null,
        message_body: lead.message?.body || null,
        sent_at: result?.success ? result.sentAt || null : null,
        status: result?.success ? 'sent' : 'failed',
        error: result?.error || null
      }
    })

    const { error: outreachInsertError } = await supabase
      .from('outreach')
      .insert(outreachRecords)

    if (outreachInsertError) {
      console.error('Failed to insert outreach records:', outreachInsertError)
    }

    console.log(`Campaign complete: ${successCount} sent, ${failureCount} failed`)

    // 10. Return results
    return NextResponse.json({
      success: true,
      campaignId,
      results,
      successCount,
      failureCount,
      emailsUsed: newEmailsUsed,
      emailsLimit,
      message: `Successfully sent to ${successCount} of ${totalToSend} leads`,
      campaign: {
        name: campaignName,
        appName,
        appDescription: appDescription || null
      }
    })
  } catch (error) {
    console.error('Outreach sending error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send messages'
      },
      { status: 500 }
    )
  }
}

// Helper: Send Twitter DM or LinkedIn message
async function sendDM(
  lead: LeadInput,
  userDbId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const platform = lead.platform || ''
    const { data: accountData, error: accountError } = await supabase
      .from('connected_accounts')
      .select('access_token, platform')
      .eq('user_id', userDbId)
      .eq('platform', platform)
      .eq('is_active', true)
      .single<ConnectedAccountRow>()

    if (accountError || !accountData?.access_token) {
      return {
        success: false,
        error: `${platform} account not connected`
      }
    }

    if (platform === 'twitter') {
      const participantId =
        lead.participantId || lead.platformUserId || lead.recipientId

      if (!participantId) {
        return {
          success: false,
          error: 'Twitter recipient participantId/platformUserId is required for DMs'
        }
      }

      const endpoint = `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(
        participantId
      )}/messages`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accountData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: lead.message?.body || ''
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        return {
          success: false,
          error: (error as { detail?: string }).detail || 'Twitter DM failed'
        }
      }

      const data = (await response.json()) as {
        data?: { dm_conversation_id?: string; id?: string }
      }
      return {
        success: true,
        messageId: data.data?.id || data.data?.dm_conversation_id
      }
    }

    if (platform === 'linkedin') {
      // LinkedIn messaging API is restricted and requires approved permissions.
      return {
        success: false,
        error: 'LinkedIn messaging not yet implemented. Use email instead.'
      }
    }

    return { success: false, error: 'Unsupported platform' }
  } catch (error) {
    console.error('DM send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'DM send failed'
    }
  }
}

// Helper: Send Email
async function sendEmail(
  lead: LeadInput,
  sendFrom: SendFrom | undefined,
  appName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: 'RESEND_API_KEY is not configured' }
    }

    const toEmail = lead.email?.trim()
    if (!toEmail) {
      return { success: false, error: 'Lead email is required for email sending' }
    }

    const fromHeader = formatFromHeader(sendFrom)
    if (!fromHeader) {
      return {
        success: false,
        error: 'sendFrom.name and sendFrom.email are required for email sending'
      }
    }

    const plainBody = lead.message?.body || ''
    const escapedHtmlBody = escapeHtml(plainBody).replace(/\n/g, '<br>')
    const subject = lead.message?.subject?.trim() || `About ${appName}`

    const { data, error } = await resend.emails.send({
      from: fromHeader,
      to: [toEmail],
      subject,
      text: plainBody,
      html: `
        <p>${escapedHtmlBody}</p>
        <br>
        <p style="color: #888; font-size: 12px;">
          Sent via Streb - Marketing Automation for Indie Hackers
        </p>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Email send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed'
    }
  }
}
