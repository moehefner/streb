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
  campaign_name: string | null
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get campaign ID from params
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

    // 3. Get user
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

    // 4. Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('autopilot_configs')
      .select('id, campaign_name')
      .eq('id', campaignId)
      .eq('user_id', userData.id)
      .single<CampaignRow>()

    if (campaignError || !campaign) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found or access denied'
        },
        { status: 404 }
      )
    }

    // 5. Delete campaign (cascade should remove related campaign-scoped records)
    const { error: deleteError } = await supabase
      .from('autopilot_configs')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', userData.id)

    if (deleteError) {
      console.error('Delete campaign error:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete campaign'
        },
        { status: 500 }
      )
    }

    console.log(`Campaign deleted: ${campaign.campaign_name || campaignId} (${campaignId})`)

    // 6. Return success
    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    })
  } catch (error) {
    console.error('Delete campaign error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete campaign'
      },
      { status: 500 }
    )
  }
}
