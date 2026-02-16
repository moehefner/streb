import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

type PageAccount = {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: {
    id?: string
    username?: string
  } | null
}

export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    if (!appUrl || !appId || !appSecret) {
      return NextResponse.json({ error: 'Meta OAuth not configured' }, { status: 500 })
    }

    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=missing_params`)
    }

    const { userId: currentUserId } = await auth()
    if (!currentUserId || currentUserId !== state) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=unauthorized`)
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', state)
      .single<{ id: string }>()

    if (userError || !userData) {
      console.error('Meta OAuth user lookup error:', userError)
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=user_not_found`)
    }

    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    tokenUrl.searchParams.append('client_id', appId)
    tokenUrl.searchParams.append('client_secret', appSecret)
    tokenUrl.searchParams.append('redirect_uri', `${appUrl}/api/oauth/meta/callback`)
    tokenUrl.searchParams.append('code', code)

    const tokenResponse = await fetch(tokenUrl.toString())
    if (!tokenResponse.ok) {
      console.error('Meta token exchange error:', await tokenResponse.text())
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=token_exchange_failed`)
    }
    const tokenData = await tokenResponse.json()

    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    longLivedUrl.searchParams.append('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.append('client_id', appId)
    longLivedUrl.searchParams.append('client_secret', appSecret)
    longLivedUrl.searchParams.append('fb_exchange_token', tokenData.access_token)

    const longLivedResponse = await fetch(longLivedUrl.toString())
    if (!longLivedResponse.ok) {
      console.error('Meta long-lived token exchange error:', await longLivedResponse.text())
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=token_exchange_failed`)
    }
    const longLivedData = await longLivedResponse.json()

    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(
        longLivedData.access_token
      )}`
    )

    if (!pagesResponse.ok) {
      console.error('Meta pages lookup error:', await pagesResponse.text())
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=page_lookup_failed`)
    }

    const pagesData = (await pagesResponse.json()) as { data?: PageAccount[] }
    const pages = Array.isArray(pagesData.data) ? pagesData.data : []

    if (pages.length === 0) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=no_pages_found`)
    }

    const page = pages[0]
    if (!page.id || !page.access_token) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=invalid_page_data`)
    }

    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in ?? 5183944))

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

    const { error: facebookError } = await connectedAccounts.upsert(
      {
        user_id: userData.id,
        platform: 'facebook',
        access_token: page.access_token,
        refresh_token: null,
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: page.id,
        account_username: page.name || null,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,platform' }
    )

    if (facebookError) {
      console.error('Meta OAuth Facebook upsert error:', facebookError)
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=db_error`)
    }

    const igBusiness = page.instagram_business_account
    if (igBusiness?.id) {
      const { error: instagramError } = await connectedAccounts.upsert(
        {
          user_id: userData.id,
          platform: 'instagram',
          access_token: page.access_token,
          refresh_token: null,
          token_expires_at: expiresAt.toISOString(),
          platform_user_id: igBusiness.id,
          account_username: igBusiness.username || page.name || null,
          is_active: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,platform' }
      )

      if (instagramError) {
        console.error('Meta OAuth Instagram upsert error:', instagramError)
        return NextResponse.redirect(`${appUrl}/dashboard/settings?error=db_error`)
      }
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?connected=meta`)
  } catch (error) {
    console.error('Meta OAuth callback error:', error)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (!appUrl) {
      return NextResponse.json({ error: 'Meta callback failed' }, { status: 500 })
    }
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=callback_failed`)
  }
}
