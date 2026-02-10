import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This is the clerk_user_id
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=${error}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=missing_params`
      )
    }

    // Verify the state matches the authenticated user
    const { userId: currentUserId } = await auth()
    if (!currentUserId || currentUserId !== state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=unauthorized`
      )
    }

    const clerkUserId = state

    // First, get the user's database ID from clerk_user_id
    type UserRow = {
      id: string;
    };

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_not_found`
      )
    }

    const userId = userData.id

    // Exchange code for access token
    // Reddit requires Basic Auth: base64(client_id:client_secret)
    const basicAuth = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
    ).toString('base64')

    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Streb/1.0' // Reddit requires User-Agent on all requests
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/reddit/callback`
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Reddit token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    // Get user info from Reddit
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Streb/1.0'
      }
    })

    if (!userResponse.ok) {
      console.error('Reddit user info error:', await userResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    const redditUserData = await userResponse.json()

    // Calculate token expiration
    // With duration=permanent: access_token expires per expires_in (typically 3600s),
    // refresh_token is permanent and can be used to obtain new access tokens
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600))

    // Store in database
    const { error: dbError } = await (supabaseAdmin
      .from('connected_accounts') as any)
      .upsert({
        user_id: userId,
        platform: 'reddit',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: redditUserData.id || null,
        account_username: redditUserData.name || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=db_error`
      )
    }

    // Redirect back to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=reddit`
    )

  } catch (error) {
    console.error('Reddit OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=callback_failed`
    )
  }
}
