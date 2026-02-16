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
    // Threads uses form body for token exchange (same as Instagram)
    const tokenResponse = await fetch('https://api.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.THREADS_CLIENT_ID!,
        client_secret: process.env.THREADS_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/threads/callback`,
        code: code
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Threads token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const shortLivedData = await tokenResponse.json()

    // Exchange short-lived token for long-lived token (~60 days)
    // Threads uses th_exchange_token (NOT ig_exchange_token)
    const longLivedUrl = new URL('https://graph.threads.net/access_token')
    longLivedUrl.searchParams.append('grant_type', 'th_exchange_token')
    longLivedUrl.searchParams.append('client_secret', process.env.THREADS_CLIENT_SECRET!)
    longLivedUrl.searchParams.append('access_token', shortLivedData.access_token)

    const longLivedResponse = await fetch(longLivedUrl.toString())

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.text()
      console.error('Threads long-lived token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const longLivedData = await longLivedResponse.json()

    // Get user info via Graph API
    const userInfoResponse = await fetch(
      'https://graph.threads.net/v1.0/me?fields=id,username',
      {
        headers: {
          'Authorization': `Bearer ${longLivedData.access_token}`
        }
      }
    )

    if (!userInfoResponse.ok) {
      console.error('Threads user info error:', await userInfoResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    const threadsUser = await userInfoResponse.json()

    if (!threadsUser?.id) {
      console.error('Threads user data missing:', threadsUser)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    // Calculate expiration from expires_in (long-lived tokens: ~60 days)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in ?? 5183944))

    // Store in database
    // NOTE: `lib/database.types.ts` is currently a placeholder, so the typed client can infer
    // `never` for some table operations. Cast to a minimal safe shape.
    const connectedAccounts = (supabaseAdmin as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options: { onConflict?: string }
        ) => Promise<{ error: unknown | null }>
      }
    }).from('connected_accounts')

    const { error: dbError } = await connectedAccounts.upsert({
        user_id: userData.id,
        platform: 'threads',
        access_token: longLivedData.access_token,
        refresh_token: null,
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: threadsUser.id,
        account_username: threadsUser.username || null,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=threads`
    )

  } catch (error) {
    console.error('Threads OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=callback_failed`
    )
  }
}
