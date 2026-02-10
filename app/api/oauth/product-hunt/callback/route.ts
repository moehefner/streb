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
    // Product Hunt uses JSON body with client credentials (not Basic Auth)
    const tokenResponse = await fetch('https://api.producthunt.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.PRODUCT_HUNT_CLIENT_ID,
        client_secret: process.env.PRODUCT_HUNT_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/product-hunt/callback`
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Product Hunt token exchange error:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    // Get user info via GraphQL (viewer query)
    const userInfoResponse = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `query { viewer { id username name } }`
      })
    })

    if (!userInfoResponse.ok) {
      console.error('Product Hunt user info error:', await userInfoResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    const graphqlData = await userInfoResponse.json()
    const phUser = graphqlData.data?.viewer

    if (!phUser) {
      console.error('Product Hunt viewer data missing:', graphqlData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=user_info_failed`
      )
    }

    // Store in database — Product Hunt tokens never expire
    const { error: dbError } = await (supabaseAdmin
      .from('connected_accounts') as any)
      .upsert({
        user_id: userId,
        platform: 'product_hunt',
        access_token: tokenData.access_token,
        refresh_token: null,
        token_expires_at: null, // Product Hunt tokens never expire
        platform_user_id: phUser.id || null,
        account_username: phUser.username || phUser.name || null,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=product_hunt`
    )

  } catch (error) {
    console.error('Product Hunt OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=callback_failed`
    )
  }
}
