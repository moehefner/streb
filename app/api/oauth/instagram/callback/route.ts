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

    // Exchange code for short-lived token
    // Instagram uses form body for token exchange (unlike Facebook which uses query params)
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/instagram/callback`,
        code: code
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Instagram token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const shortLivedData = await tokenResponse.json()

    // Exchange short-lived token for long-lived token (~60 days)
    const longLivedUrl = new URL('https://graph.instagram.com/access_token')
    longLivedUrl.searchParams.append('grant_type', 'ig_exchange_token')
    longLivedUrl.searchParams.append('client_secret', process.env.INSTAGRAM_CLIENT_SECRET!)
    longLivedUrl.searchParams.append('access_token', shortLivedData.access_token)

    const longLivedResponse = await fetch(longLivedUrl.toString())

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.text()
      console.error('Instagram long-lived token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const longLivedData = await longLivedResponse.json()

    // Get user info via Graph API
    const userInfoResponse = await fetch(
      'https://graph.instagram.com/me?fields=id,username',
      {
        headers: {
          'Authorization': `Bearer ${longLivedData.access_token}`
        }
      }
    )

    if (!userInfoResponse.ok) {
      console.error('Instagram user info error:', await userInfoResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    const igUser = await userInfoResponse.json()

    if (!igUser?.id) {
      console.error('Instagram user data missing:', igUser)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    // Calculate expiration from expires_in (long-lived tokens: ~60 days)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in ?? 5183944))

    // Store in database
    const { error: dbError } = await (supabaseAdmin
      .from('connected_accounts') as any)
      .upsert({
        user_id: userData.id,
        platform: 'instagram',
        access_token: longLivedData.access_token,
        refresh_token: null,
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: igUser.id,
        account_username: igUser.username || null,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=instagram`
    )

  } catch (error) {
    console.error('Instagram OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=callback_failed`
    )
  }
}
