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

async function getUserRow(clerkUserId: string): Promise<{ data: UserRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single<UserRow>()

  return { data, error }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = await req.json()
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''

    if (!campaignId) {
      return NextResponse.json(
        {
          success: false,
          error: 'campaignId is required'
        },
        { status: 400 }
      )
    }

    // 3. Get user
    const { data: userData, error: userError } = await getUserRow(userId)

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 4. Update config to active
    const { data: updatedRow, error: updateError } = await supabase
      .from('autopilot_configs')
      .update({
        is_paused: false,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('user_id', userData.id)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (updateError) {
      console.error('Resume error:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to resume AutoPilot'
        },
        { status: 500 }
      )
    }

    if (!updatedRow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found or access denied'
        },
        { status: 404 }
      )
    }

    console.log(`AutoPilot resumed for campaign ${campaignId} (user: ${userData.id})`)

    return NextResponse.json({
      success: true,
      message: 'AutoPilot resumed'
    })
  } catch (error) {
    console.error('Resume AutoPilot error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume'
      },
      { status: 500 }
    )
  }
}
