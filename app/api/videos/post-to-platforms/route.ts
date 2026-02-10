import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// Type definitions
type UserRow = {
  id: string
  videos_used: number
  videos_limit: number
}

// Platform posting endpoints
const VIDEO_PLATFORM_ENDPOINTS: Record<string, string> = {
  tiktok: '/api/videos/post-tiktok',
  youtube: '/api/videos/post-youtube',
  // instagram: '/api/videos/post-instagram', // TODO: Add later (uses Reels API)
  // twitter: '/api/posts/publish-twitter', // Can reuse from POST feature for video tweets
}

type PlatformResult = {
  success: boolean
  postId?: string
  postUrl?: string
  username?: string
  error?: string
  status?: string
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse request
    const body = await req.json()
    const { videoUrl, platforms, title, description, tags, hashtags } = body as {
      videoUrl: string
      platforms: string[]
      title?: string
      description?: string
      tags?: string[]
      hashtags?: string[]
    }

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 })
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'At least one platform must be selected'
      }, { status: 400 })
    }

    // 3. Get user from database to check limits
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, videos_used, videos_limit')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    console.log(`Posting video to platforms: ${platforms.join(', ')} for user ${userData.id}`)

    // 4. Post to each platform
    const results: Record<string, PlatformResult> = {}

    for (const platform of platforms) {
      const endpoint = VIDEO_PLATFORM_ENDPOINTS[platform]

      if (!endpoint) {
        console.warn(`No endpoint for platform: ${platform}`)
        results[platform] = {
          success: false,
          error: `Platform not yet supported: ${platform}`
        }
        continue
      }

      try {
        console.log(`Posting to ${platform}...`)

        // Build platform-specific payload
        const platformPayload: Record<string, unknown> = {
          videoUrl,
          title: title || 'Check out this video!',
          caption: description || title || 'Check out this video!',
          description: description || title || 'Check out this video!',
          tags: tags || [],
          hashtags: hashtags || []
        }

        // YouTube Shorts specific
        if (platform === 'youtube') {
          platformPayload.isShort = true
        }

        // Call platform-specific posting endpoint
        const platformResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}${endpoint}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify(platformPayload)
          }
        )

        const platformResult = await platformResponse.json()

        if (platformResult.success) {
          console.log(`Successfully posted to ${platform}:`, platformResult.postUrl)
          results[platform] = {
            success: true,
            postId: platformResult.postId,
            postUrl: platformResult.postUrl,
            username: platformResult.username,
            status: platformResult.status || 'published'
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

    // 5. Count successes
    const successfulPosts = Object.values(results).filter(r => r.success).length
    const failedPosts = Object.values(results).filter(r => !r.success).length

    console.log(`Posted to ${successfulPosts}/${platforms.length} platforms`)

    // 6. Return results
    return NextResponse.json({
      success: successfulPosts > 0,
      results,
      successfulPosts,
      failedPosts,
      totalPlatforms: platforms.length,
      message: successfulPosts > 0
        ? `Successfully posted to ${successfulPosts} platform${successfulPosts !== 1 ? 's' : ''}${failedPosts > 0 ? ` (${failedPosts} failed)` : ''}`
        : 'Failed to post to any platforms'
    })

  } catch (error) {
    console.error('Video posting orchestrator error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post video'
    }, { status: 500 })
  }
}
