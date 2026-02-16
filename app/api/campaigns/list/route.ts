import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserRow = {
  id: string
  campaigns_used: number | null
  campaigns_limit: number | null
  plan_type: string | null
}

type AutoPilotCampaignRow = {
  id: string
  campaign_name: string | null
  app_name: string | null
  app_description: string | null
  is_active: boolean | null
  is_paused: boolean | null
  platforms: Record<string, boolean> | null
  created_at: string
  updated_at: string
}

export async function GET() {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, campaigns_used, campaigns_limit, plan_type')
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

    // 3. Get all campaigns for this user
    const { data: campaigns, error: campaignsError } = await supabase
      .from('autopilot_configs')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })

    if (campaignsError) {
      console.error('Campaigns fetch error:', campaignsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch campaigns'
        },
        { status: 500 }
      )
    }

    const campaignRows = (campaigns || []) as AutoPilotCampaignRow[]

    // 4. Format campaigns for display
    const formattedCampaigns = campaignRows.map((campaign) => ({
      id: campaign.id,
      name: campaign.campaign_name || campaign.app_name || 'Untitled Campaign',
      appName: campaign.app_name || '',
      appDescription: campaign.app_description || '',
      isActive: Boolean(campaign.is_active),
      isPaused: Boolean(campaign.is_paused),
      platforms: campaign.platforms || {},
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at
    }))

    const campaignsUsed = campaignRows.length
    const campaignsLimit = userData.campaigns_limit ?? 0

    // 5. Return campaigns with user limits
    return NextResponse.json({
      success: true,
      campaigns: formattedCampaigns,
      campaignsUsed,
      campaignsLimit,
      canCreateMore: campaignsUsed < campaignsLimit
    })
  } catch (error) {
    console.error('List campaigns error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list campaigns'
      },
      { status: 500 }
    )
  }
}
