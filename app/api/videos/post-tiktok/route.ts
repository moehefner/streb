import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// Type definitions
type UserRow = {
  id: string
}

type TikTokAccountRow = {
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  account_username: string
  platform_user_id: string | null
}

type TikTokUploadResponse = {
  data?: {
    share_id?: string
    video_id?: string
    publish_id?: string
  }
  error?: {
    code: string
    message: string
    log_id?: string
  }
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
    const { videoUrl, caption, hashtags } = body as {
      videoUrl: string
      caption?: string
      hashtags?: string[]
    }

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 })
    }

    // 3. Get user from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // 4. Get TikTok connected account
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, refresh_token, token_expires_at, account_username, platform_user_id')
      .eq('user_id', userData.id)
      .eq('platform', 'tiktok')
      .eq('is_active', true)
      .single<TikTokAccountRow>()

    if (accountError || !accountData) {
      return NextResponse.json({
        success: false,
        error: 'TikTok account not connected. Please connect TikTok in Settings.'
      }, { status: 400 })
    }

    // 5. Check token expiration
    if (accountData.token_expires_at) {
      const expiresAt = new Date(accountData.token_expires_at)
      if (expiresAt <= new Date()) {
        // TODO: Implement token refresh using refresh_token
        return NextResponse.json({
          success: false,
          error: 'TikTok token expired. Please reconnect TikTok in Settings.'
        }, { status: 401 })
      }
    }

    console.log(`Posting video to TikTok for user ${userData.id}`)

    // 6. Download video from Supabase Storage URL
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to download video from storage'
      }, { status: 500 })
    }

    const videoBuffer = await videoResponse.arrayBuffer()
    const videoSize = videoBuffer.byteLength

    // Check TikTok size limit (287MB)
    const maxSize = 287 * 1024 * 1024
    if (videoSize > maxSize) {
      return NextResponse.json({
        success: false,
        error: `Video too large for TikTok. Max size is 287MB, your video is ${Math.round(videoSize / 1024 / 1024)}MB`
      }, { status: 400 })
    }

    // 7. Build caption with hashtags
    const hashtagString = hashtags && hashtags.length > 0
      ? ' ' + hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')
      : ''
    const fullCaption = (caption || '') + hashtagString

    // TikTok caption limit is 2200 characters
    const truncatedCaption = fullCaption.substring(0, 2200)

    // 8. Initialize video upload with TikTok Content Posting API
    // Step 1: Create upload session
    const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accountData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post_info: {
          title: truncatedCaption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize, // Single chunk upload for simplicity
          total_chunk_count: 1
        }
      })
    })

    if (!initResponse.ok) {
      const errorData = await initResponse.json() as TikTokUploadResponse
      console.error('TikTok init error:', errorData)

      if (errorData.error?.code === 'access_token_invalid' ||
          errorData.error?.code === 'token_expired') {
        return NextResponse.json({
          success: false,
          error: 'TikTok token expired. Please reconnect TikTok in Settings.'
        }, { status: 401 })
      }

      return NextResponse.json({
        success: false,
        error: `TikTok API error: ${errorData.error?.message || 'Failed to initialize upload'}`,
        tiktokError: errorData.error
      }, { status: initResponse.status })
    }

    const initData = await initResponse.json()
    const uploadUrl = initData.data?.upload_url
    const publishId = initData.data?.publish_id

    if (!uploadUrl) {
      return NextResponse.json({
        success: false,
        error: 'TikTok did not provide upload URL'
      }, { status: 500 })
    }

    // Step 2: Upload video chunk
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoSize.toString(),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`
      },
      body: Buffer.from(videoBuffer)
    })

    if (!uploadResponse.ok) {
      console.error('TikTok upload error:', uploadResponse.status)
      return NextResponse.json({
        success: false,
        error: 'Failed to upload video to TikTok'
      }, { status: 500 })
    }

    // Step 3: Check publish status (poll until complete)
    let videoId: string | null = null
    let attempts = 0
    const maxAttempts = 30 // 30 attempts * 2 seconds = 60 seconds max wait

    while (!videoId && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      const statusResponse = await fetch(
        `https://open.tiktokapis.com/v2/post/publish/status/fetch/?publish_id=${publishId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accountData.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        const status = statusData.data?.status

        if (status === 'PUBLISH_COMPLETE') {
          videoId = statusData.data?.video_id
          break
        } else if (status === 'FAILED') {
          return NextResponse.json({
            success: false,
            error: `TikTok publishing failed: ${statusData.data?.fail_reason || 'Unknown reason'}`
          }, { status: 500 })
        }
        // PROCESSING_UPLOAD or PROCESSING_DOWNLOAD - keep waiting
      }
    }

    if (!videoId) {
      // Publishing still in progress - return publish_id for later checking
      console.log('TikTok video still processing, returning publish_id:', publishId)
    }

    // Construct TikTok video URL
    const postUrl = videoId
      ? `https://www.tiktok.com/@${accountData.account_username}/video/${videoId}`
      : `https://www.tiktok.com/@${accountData.account_username}`

    // Update last_used_at for the connected account
    // NOTE: `lib/database.types.ts` is currently a placeholder, so the typed client can infer
    // `never` for some table operations. Cast to a minimal safe shape.
    type EqChain = { eq: (column: string, value: unknown) => EqChain }
    const connectedAccounts = (supabaseAdmin as unknown as {
      from: (table: string) => {
        update: (values: Record<string, unknown>) => EqChain
      }
    }).from('connected_accounts')

    await connectedAccounts
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userData.id)
      .eq('platform', 'tiktok')

    console.log(`Successfully posted to TikTok: ${postUrl}`)

    return NextResponse.json({
      success: true,
      platform: 'tiktok',
      postId: videoId || publishId,
      publishId: publishId,
      postUrl: postUrl,
      username: accountData.account_username,
      status: videoId ? 'published' : 'processing',
      message: videoId
        ? 'Video published successfully to TikTok'
        : 'Video is being processed by TikTok. It will appear on your profile shortly.'
    })

  } catch (error) {
    console.error('TikTok posting error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post to TikTok'
    }, { status: 500 })
  }
}
