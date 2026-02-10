import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// YouTube OAuth 2.0 Configuration
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!
const YOUTUBE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/youtube/callback`

// Type definitions
type UserRow = {
  id: string
}

type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

type YouTubeChannelResponse = {
  items?: Array<{
    id: string
    snippet: {
      title: string
      customUrl?: string
      thumbnails?: {
        default?: { url: string }
      }
    }
  }>
  error?: {
    code: number
    message: string
  }
}

type GoogleUserInfo = {
  id: string
  name: string
  picture?: string
  error?: {
    code: number
    message: string
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Get authorization code and state from query params
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')
    const errorDescription = req.nextUrl.searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      console.error('YouTube OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=Missing authorization code`
      )
    }

    // 2. Verify CSRF state and extract userId
    let stateData: { userId: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=Invalid state parameter`
      )
    }

    // 3. Verify current user matches state userId (CSRF protection)
    const { userId: currentUserId } = await auth()
    if (!currentUserId || currentUserId !== stateData.userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=Session mismatch. Please try again.`
      )
    }

    // 4. Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: YOUTUBE_CLIENT_ID,
        client_secret: YOUTUBE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: YOUTUBE_REDIRECT_URI
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('YouTube token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(errorData.error_description || 'Failed to get access token')}`
      )
    }

    const tokenData = await tokenResponse.json() as GoogleTokenResponse

    if (tokenData.error) {
      console.error('YouTube token error:', tokenData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      )
    }

    // 5. Get YouTube channel info
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    )

    let channelName = 'YouTube User'
    let channelId: string | null = null
    let channelHandle: string | null = null

    if (channelResponse.ok) {
      const channelData = await channelResponse.json() as YouTubeChannelResponse
      if (channelData.items && channelData.items.length > 0) {
        const channel = channelData.items[0]
        channelId = channel.id
        channelName = channel.snippet.title
        channelHandle = channel.snippet.customUrl || null
      }
    }

    // If no YouTube channel, get Google user info instead
    if (!channelId) {
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        }
      )

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json() as GoogleUserInfo
        channelName = userInfo.name || 'YouTube User'
        channelId = userInfo.id
      }
    }

    // 6. Get internal user ID from Supabase
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', currentUserId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=User not found`
      )
    }

    // 7. Calculate token expiration
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // 8. Upsert connected account
    const { error: upsertError } = await supabaseAdmin
      .from('connected_accounts')
      .upsert({
        user_id: userData.id,
        platform: 'youtube',
        account_username: channelHandle || channelName,
        platform_user_id: channelId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        is_active: true,
        connected_at: new Date().toISOString()
      } as any, {
        onConflict: 'user_id,platform'
      })

    if (upsertError) {
      console.error('Failed to save YouTube account:', upsertError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=Failed to save account`
      )
    }

    console.log(`YouTube account connected: ${channelHandle || channelName} for user ${userData.id}`)

    // 9. Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=youtube&username=${encodeURIComponent(channelHandle || channelName)}`
    )

  } catch (error) {
    console.error('YouTube OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'OAuth callback failed')}`
    )
  }
}
