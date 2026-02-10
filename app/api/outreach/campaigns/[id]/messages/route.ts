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

type CampaignOwnerRow = {
  id: string
  user_id: string
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get campaign ID from URL
    const { id } = await context.params
    const campaignId = id?.trim()
    if (!campaignId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign ID is required'
        },
        { status: 400 }
      )
    }

    // 3. Get user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
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

    // 4. Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .single<CampaignOwnerRow>()

    if (campaignError || !campaign) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found'
        },
        { status: 404 }
      )
    }

    if (campaign.user_id !== userData.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized access to campaign'
        },
        { status: 403 }
      )
    }

    // 5. Fetch all outreach messages for this campaign
    const { data: messages, error: messagesError } = await supabase
      .from('outreach')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false })

    if (messagesError) {
      console.error('Messages fetch error:', messagesError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch messages'
        },
        { status: 500 }
      )
    }

    // 6. Return messages
    return NextResponse.json({
      success: true,
      messages: messages || []
    })
  } catch (error) {
    console.error('Campaign messages error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch campaign messages'
      },
      { status: 500 }
    )
  }
}
