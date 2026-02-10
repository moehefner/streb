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

type CampaignRow = {
  id: string
  name: string
  platform: string | null
  total_leads: number | null
  sent_count: number | null
  failed_count: number | null
  replied_count: number | null
  status: string | null
  created_at: string
  completed_at: string | null
}

export async function GET(_req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user from database
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

    // 3. Fetch all campaigns for this user
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
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

    const campaignRows = (campaigns || []) as CampaignRow[]

    // 4. Calculate overall stats
    const stats = {
      totalCampaigns: campaignRows.length,
      totalSent: campaignRows.reduce((sum, c) => sum + (c.sent_count ?? 0), 0),
      totalReplies: campaignRows.reduce((sum, c) => sum + (c.replied_count ?? 0), 0),
      replyRate: 0
    }

    // Calculate reply rate
    if (stats.totalSent > 0) {
      stats.replyRate = (stats.totalReplies / stats.totalSent) * 100
    }

    // 5. Return campaigns and stats
    return NextResponse.json({
      success: true,
      campaigns: campaignRows,
      stats
    })
  } catch (error) {
    console.error('Campaigns list error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch campaigns'
      },
      { status: 500 }
    )
  }
}
