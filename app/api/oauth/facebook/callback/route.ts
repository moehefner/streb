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

    // Exchange code for short-lived access token
    // Facebook uses query params for token exchange (not body like LinkedIn)
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    tokenUrl.searchParams.append('client_id', process.env.FACEBOOK_APP_ID!)
    tokenUrl.searchParams.append('client_secret', process.env.FACEBOOK_APP_SECRET!)
    tokenUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/facebook/callback`)
    tokenUrl.searchParams.append('code', code)

    const tokenResponse = await fetch(tokenUrl.toString())

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Facebook token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    // Exchange short-lived token for long-lived token (~60 days)
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    longLivedUrl.searchParams.append('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.append('client_id', process.env.FACEBOOK_APP_ID!)
    longLivedUrl.searchParams.append('client_secret', process.env.FACEBOOK_APP_SECRET!)
    longLivedUrl.searchParams.append('fb_exchange_token', tokenData.access_token)

    const longLivedResponse = await fetch(longLivedUrl.toString())

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.text()
      console.error('Facebook long-lived token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const longLivedData = await longLivedResponse.json()

    // Get user info via Graph API
    const userInfoResponse = await fetch(
      'https://graph.facebook.com/v18.0/me?fields=id,name',
      {
        headers: {
          'Authorization': `Bearer ${longLivedData.access_token}`
        }
      }
    )

    if (!userInfoResponse.ok) {
      console.error('Facebook user info error:', await userInfoResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    const fbUser = await userInfoResponse.json()

    if (!fbUser?.id) {
      console.error('Facebook user data missing:', fbUser)
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
        platform: 'facebook',
        access_token: longLivedData.access_token,
        refresh_token: null,
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: fbUser.id,
        account_username: fbUser.name || null,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=facebook`
    )

  } catch (error) {
    console.error('Facebook OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=callback_failed`
    )
  }
}
