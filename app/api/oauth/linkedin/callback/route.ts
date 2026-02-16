import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

    if (!appUrl || !clientId || !clientSecret) {
      return NextResponse.json({ error: 'LinkedIn OAuth not configured' }, { status: 500 })
    }

    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This is the clerk_user_id
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=${error}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=missing_params`
      )
    }

    // Verify the state matches the authenticated user
    const { userId: currentUserId } = await auth()
    if (!currentUserId || currentUserId !== state) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=unauthorized`
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
        `${appUrl}/dashboard/settings?error=user_not_found`
      )
    }

    const userId = userData.id

    // Exchange code for access token
    // LinkedIn uses form-encoded client credentials in the body (not Basic Auth)
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${appUrl}/api/oauth/linkedin/callback`,
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('LinkedIn token exchange error:', errorData)
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    // Get member profile from LinkedIn
    const userResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    if (!userResponse.ok) {
      console.error('LinkedIn user info error:', await userResponse.text())
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=user_info_failed`
      )
    }

    const linkedinUserData = await userResponse.json()
    const localizedFirstName =
      typeof linkedinUserData.localizedFirstName === 'string'
        ? linkedinUserData.localizedFirstName
        : ''
    const localizedLastName =
      typeof linkedinUserData.localizedLastName === 'string'
        ? linkedinUserData.localizedLastName
        : ''
    const profileName = `${localizedFirstName} ${localizedLastName}`.trim()

    // Calculate token expiration from expires_in (LinkedIn tokens last ~60 days)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 5184000))

    // Store in database
    // NOTE: `lib/database.types.ts` is currently a placeholder, so the typed client
    // can infer `never` for some table operations. Cast to a minimal safe shape.
    const connectedAccounts = (supabaseAdmin as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options: { onConflict?: string }
        ) => Promise<{ error: unknown | null }>
      }
    }).from('connected_accounts')

    const { error: dbError } = await connectedAccounts.upsert({
        user_id: userId,
        platform: 'linkedin',
        access_token: tokenData.access_token,
        refresh_token: null, // LinkedIn does not provide refresh tokens
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: linkedinUserData.id || null,
        account_username: profileName || linkedinUserData.id || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=db_error`
      )
    }

    // Redirect back to settings with success
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?connected=linkedin`
    )

  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (!appUrl) {
      return NextResponse.json({ error: 'LinkedIn callback failed' }, { status: 500 })
    }
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=callback_failed`
    )
  }
}
