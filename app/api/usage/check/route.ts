import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserUsageRow = {
  id: string
  posts_used: number | null
  posts_limit: number | null
  videos_used: number | null
  videos_limit: number | null
  emails_used: number | null
  emails_limit: number | null
  plan_type: string | null
}

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toUsage(used: number, limit: number) {
  const safeLimit = limit > 0 ? limit : 1
  const remaining = Math.max(0, limit - used)
  const percentage = Math.min(100, (used / safeLimit) * 100)

  return {
    used,
    limit,
    percentage,
    remaining
  }
}

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserUsageRow>()

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    const postsUsed = toNumber(user.posts_used, 0)
    const postsLimit = toNumber(user.posts_limit, 5)
    const videosUsed = toNumber(user.videos_used, 0)
    const videosLimit = toNumber(user.videos_limit, 3)
    const emailsUsed = toNumber(user.emails_used, 0)
    const emailsLimit = toNumber(user.emails_limit, 25)

    return NextResponse.json({
      success: true,
      posts: toUsage(postsUsed, postsLimit),
      videos: toUsage(videosUsed, videosLimit),
      outreach: toUsage(emailsUsed, emailsLimit),
      plan: user.plan_type || 'free',
      needsUpgrade: postsUsed >= postsLimit * 0.8
    })
  } catch (error) {
    console.error('Usage check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check usage'
      },
      { status: 500 }
    )
  }
}
