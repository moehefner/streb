import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { google } from 'googleapis'
import { Readable } from 'stream'

// Type definitions
type UserRow = {
  id: string
}

type YouTubeAccountRow = {
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  account_username: string
  platform_user_id: string | null
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
    const { videoUrl, title, description, tags, isShort = true } = body as {
      videoUrl: string
      title: string
      description?: string
      tags?: string[]
      isShort?: boolean
    }

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({
        success: false,
        error: 'Video title is required'
      }, { status: 400 })
    }

    // YouTube title limit is 100 characters
    if (title.length > 100) {
      return NextResponse.json({
        success: false,
        error: 'Title must be 100 characters or less'
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

    // 4. Get YouTube connected account
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, refresh_token, token_expires_at, account_username, platform_user_id')
      .eq('user_id', userData.id)
      .eq('platform', 'youtube')
      .eq('is_active', true)
      .single<YouTubeAccountRow>()

    if (accountError || !accountData) {
      return NextResponse.json({
        success: false,
        error: 'YouTube account not connected. Please connect YouTube in Settings.'
      }, { status: 400 })
    }

    // 5. Setup OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/youtube/callback`
    )

    // 6. Check/refresh token if expired
    let accessToken = accountData.access_token

    if (accountData.token_expires_at) {
      const expiresAt = new Date(accountData.token_expires_at)
      const now = new Date()

      // Refresh if token expires within 5 minutes
      if (expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
        if (!accountData.refresh_token) {
          return NextResponse.json({
            success: false,
            error: 'YouTube token expired and no refresh token available. Please reconnect YouTube in Settings.'
          }, { status: 401 })
        }

        console.log('Refreshing YouTube access token...')

        oauth2Client.setCredentials({
          refresh_token: accountData.refresh_token
        })

        try {
          const { credentials } = await oauth2Client.refreshAccessToken()
          accessToken = credentials.access_token!

          // Calculate new expiry
          const newExpiresAt = credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString()

          // Update token in database
          await (supabaseAdmin
            .from('connected_accounts') as any)
            .update({
              access_token: accessToken,
              token_expires_at: newExpiresAt,
              refresh_token: credentials.refresh_token || accountData.refresh_token
            })
            .eq('user_id', userData.id)
            .eq('platform', 'youtube')

          console.log('YouTube token refreshed successfully')
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError)
          return NextResponse.json({
            success: false,
            error: 'Failed to refresh YouTube token. Please reconnect YouTube in Settings.'
          }, { status: 401 })
        }
      }
    }

    console.log(`Uploading video to YouTube${isShort ? ' Shorts' : ''}: ${title}`)

    // 7. Download video from Supabase Storage
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to download video from storage'
      }, { status: 500 })
    }

    const videoBuffer = await videoResponse.arrayBuffer()
    const videoSize = videoBuffer.byteLength

    // YouTube limit is 256GB, but for Shorts we want < 60 seconds
    console.log(`Video size: ${Math.round(videoSize / 1024 / 1024)}MB`)

    // 8. Set credentials and create YouTube client
    oauth2Client.setCredentials({ access_token: accessToken })

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    })

    // 9. Prepare video metadata for Shorts
    // For Shorts: add #Shorts hashtag to title/description
    let finalTitle = title.trim()
    let finalDescription = (description || '').trim()

    if (isShort) {
      // Add #Shorts if not already present
      if (!finalTitle.toLowerCase().includes('#shorts')) {
        // Keep title under 100 chars
        if (finalTitle.length + 8 <= 100) {
          finalTitle = `${finalTitle} #Shorts`
        }
      }

      if (!finalDescription.toLowerCase().includes('#shorts')) {
        finalDescription = finalDescription
          ? `${finalDescription}\n\n#Shorts`
          : '#Shorts'
      }
    }

    // 10. Convert buffer to readable stream for upload
    const videoStream = Readable.from(Buffer.from(videoBuffer))

    // 11. Upload video to YouTube
    const uploadResponse = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: finalTitle,
          description: finalDescription,
          tags: tags || ['streb', 'ai', 'marketing'],
          categoryId: '22', // People & Blogs (good default for SaaS demos)
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en'
        },
        status: {
          privacyStatus: 'public',
          madeForKids: false,
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        mimeType: 'video/mp4',
        body: videoStream
      }
    })

    const videoId = uploadResponse.data.id

    if (!videoId) {
      return NextResponse.json({
        success: false,
        error: 'YouTube upload succeeded but no video ID returned'
      }, { status: 500 })
    }

    // 12. Construct video URLs
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
    const shortsUrl = `https://www.youtube.com/shorts/${videoId}`
    const finalUrl = isShort ? shortsUrl : watchUrl

    // 13. Update last_used_at for the connected account
    await (supabaseAdmin
      .from('connected_accounts') as any)
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userData.id)
      .eq('platform', 'youtube')

    console.log(`Successfully uploaded to YouTube: ${finalUrl}`)

    return NextResponse.json({
      success: true,
      platform: 'youtube',
      postId: videoId,
      postUrl: finalUrl,
      watchUrl: watchUrl,
      shortsUrl: shortsUrl,
      username: accountData.account_username,
      isShort: isShort,
      title: finalTitle,
      message: isShort
        ? 'Video uploaded as YouTube Short successfully'
        : 'Video uploaded to YouTube successfully'
    })

  } catch (error) {
    console.error('YouTube posting error:', error)

    // Handle specific YouTube API errors
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as { code: number; message?: string; errors?: Array<{ reason: string }> }

      if (apiError.code === 403) {
        const reason = apiError.errors?.[0]?.reason

        if (reason === 'quotaExceeded') {
          return NextResponse.json({
            success: false,
            error: 'YouTube API daily quota exceeded. Please try again tomorrow.'
          }, { status: 403 })
        }

        if (reason === 'forbidden') {
          return NextResponse.json({
            success: false,
            error: 'YouTube upload permission denied. Please reconnect YouTube with upload permissions.'
          }, { status: 403 })
        }

        return NextResponse.json({
          success: false,
          error: 'YouTube API access denied. Please check your account permissions.'
        }, { status: 403 })
      }

      if (apiError.code === 401) {
        return NextResponse.json({
          success: false,
          error: 'YouTube authentication failed. Please reconnect YouTube in Settings.'
        }, { status: 401 })
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post to YouTube'
    }, { status: 500 })
  }
}
