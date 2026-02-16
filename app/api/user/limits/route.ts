import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserLimitsRow = {
  posts_used: number | null
  posts_limit: number | null
  videos_used: number | null
  videos_limit: number | null
  emails_used: number | null
  emails_limit: number | null
  plan_type: string | null
}

export async function GET() {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(
        'posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit, plan_type'
      )
      .eq('clerk_user_id', userId)
      .single<UserLimitsRow>()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 3. Return all usage limits
    return NextResponse.json({
      success: true,
      posts_used: userData.posts_used ?? 0,
      posts_limit: userData.posts_limit ?? 5,
      videos_used: userData.videos_used ?? 0,
      videos_limit: userData.videos_limit ?? 3,
      emails_used: userData.emails_used ?? 0,
      emails_limit: userData.emails_limit ?? 25,
      plan_type: userData.plan_type ?? 'free'
    })
  } catch (error) {
    console.error('User limits error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user limits'
      },
      { status: 500 }
    )
  }
}
