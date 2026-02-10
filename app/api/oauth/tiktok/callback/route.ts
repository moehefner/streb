import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// TikTok OAuth 2.0 Configuration
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET!
const TIKTOK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/tiktok/callback`

// Type definitions
type UserRow = {
  id: string
}

type TikTokTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  open_id: string
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

type TikTokUserInfo = {
  data: {
    user: {
      open_id: string
      union_id: string
      display_name: string
      avatar_url: string
      username?: string
    }
  }
  error?: {
    code: string
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
      console.error('TikTok OAuth error:', error, errorDescription)
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
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: TIKTOK_REDIRECT_URI
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('TikTok token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(errorData.error_description || 'Failed to get access token')}`
      )
    }

    const tokenData = await tokenResponse.json() as TikTokTokenResponse

    if (tokenData.error) {
      console.error('TikTok token error:', tokenData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      )
    }

    // 5. Get TikTok user info
    const userInfoResponse = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,username',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    )

    let username = 'tiktok_user'
    let displayName = 'TikTok User'

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json() as TikTokUserInfo
      if (userInfo.data?.user) {
        username = userInfo.data.user.username || userInfo.data.user.display_name || 'tiktok_user'
        displayName = userInfo.data.user.display_name || username
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
        platform: 'tiktok',
        account_username: username,
        platform_user_id: tokenData.open_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
        connected_at: new Date().toISOString()
      } as any, {
        onConflict: 'user_id,platform'
      })

    if (upsertError) {
      console.error('Failed to save TikTok account:', upsertError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=Failed to save account`
      )
    }

    console.log(`TikTok account connected: @${username} for user ${userData.id}`)

    // 9. Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=tiktok&username=${encodeURIComponent(username)}`
    )

  } catch (error) {
    console.error('TikTok OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'OAuth callback failed')}`
    )
  }
}
