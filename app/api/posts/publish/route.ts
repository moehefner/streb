import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// Platform-specific posting endpoints (internal API routes)
const PLATFORM_ENDPOINTS: Record<string, string> = {
  twitter: '/api/posts/publish-twitter',
  reddit: '/api/posts/publish-reddit',
  linkedin: '/api/posts/publish-linkedin',
  product_hunt: '/api/posts/publish-product-hunt',
  facebook: '/api/posts/publish-facebook',
  instagram: '/api/posts/publish-instagram',
  threads: '/api/posts/publish-threads',
}

type PostPayload = { content?: string; imageUrl?: string }
type PublishResult = {
  success: boolean
  postId?: string
  postUrl?: string
  username?: string
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await req.json()
    const { posts } = body as { posts?: Record<string, PostPayload> }
    // posts format: { twitter: { content, imageUrl }, reddit: { content, imageUrl }, ... }

    if (!posts || typeof posts !== 'object' || Object.keys(posts).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No posts provided' },
        { status: 400 }
      )
    }

    const platforms = Object.keys(posts)
    console.log('Publishing to platforms:', platforms)

    // 3. Get user from database (id, usage, limits)
    type UserRow = {
      id: string
      posts_used: number | null
      posts_limit: number | null
      plan_type: string | null
    }
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, posts_used, posts_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const postsUsed = userData.posts_used ?? 0
    const postsLimit = userData.posts_limit ?? 0

    // 4. CRITICAL: Check usage limits BEFORE posting
    if (postsUsed >= postsLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `You've reached your limit of ${postsLimit} posts this month. Upgrade your plan to post more.`,
          upgradeRequired: true,
          currentPlan: userData.plan_type ?? 'free',
          postsUsed,
          postsLimit
        },
        { status: 403 }
      )
    }

    // 5. Post to each platform sequentially
    const results: Record<string, PublishResult> = {}
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const cookie = req.headers.get('cookie') || ''

    for (const platform of platforms) {
      const platformEndpoint = PLATFORM_ENDPOINTS[platform]

      if (!platformEndpoint) {
        console.warn(`No endpoint for platform: ${platform}`)
        results[platform] = {
          success: false,
          error: `Platform not yet supported: ${platform}`
        }
        continue
      }

      const postData = posts[platform]
      const content = postData?.content ?? ''
      const imageUrl = postData?.imageUrl

      try {
        console.log(`Posting to ${platform}...`)

        const platformResponse = await fetch(`${baseUrl}${platformEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie
          },
          body: JSON.stringify({ content, imageUrl })
        })

        const platformResult = (await platformResponse.json()) as {
          success?: boolean
          postId?: string
          postUrl?: string
          username?: string
          error?: string
        }

        if (platformResult.success) {
          console.log(`Successfully posted to ${platform}:`, platformResult.postUrl)
          results[platform] = {
            success: true,
            postId: platformResult.postId,
            postUrl: platformResult.postUrl,
            username: platformResult.username
          }
        } else {
          console.error(`Failed to post to ${platform}:`, platformResult.error)
          results[platform] = {
            success: false,
            error: platformResult.error || 'Unknown error'
          }
        }
      } catch (error) {
        console.error(`Error posting to ${platform}:`, error)
        results[platform] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // 6. Count successful vs failed
    const successfulPosts = Object.values(results).filter((r) => r.success).length
    const failedPosts = Object.values(results).filter((r) => !r.success).length

    console.log(`Posted to ${successfulPosts}/${platforms.length} platforms`)

    // 7. If NO posts succeeded, return error and do NOT increment usage
    if (successfulPosts === 0) {
      return NextResponse.json({
        success: false,
        error:
          'Failed to post to any platform. Please check your connected accounts.',
        results,
        successfulPosts: 0,
        failedPosts
      })
    }

    // 8. At least one post succeeded: increment usage
    const newPostsUsed = postsUsed + 1
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        posts_used: newPostsUsed,
        updated_at: new Date().toISOString()
      } as unknown as never)
      .eq('id', userData.id)

    if (updateError) {
      console.error('Failed to update posts_used:', updateError)
    }

    // 9. Save post to database for history/analytics (posts table schema)
    const postRecord = {
      user_id: userData.id,
      post_type: 'social',
      content_text: JSON.stringify(posts),
      platforms,
      posted_at: new Date().toISOString(),
      status: 'posted',
      engagement: results
    }
    const { error: postSaveError } = await (supabaseAdmin.from('posts') as any)
      .insert(postRecord)

    if (postSaveError) {
      console.error('Failed to save post to database:', postSaveError)
    }

    // 10. Return success with results
    return NextResponse.json({
      success: true,
      results,
      successfulPosts,
      failedPosts,
      postsUsed: newPostsUsed,
      postsLimit,
      message: `Successfully posted to ${successfulPosts} platform${successfulPosts > 1 ? 's' : ''}`
    })
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to publish posts'
      },
      { status: 500 }
    )
  }
}
