import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

function popupResponse(
  appUrl: string,
  result: { type: 'oauth-success'; platform: 'twitter' } | { type: 'oauth-error'; error: string }
) {
  const payload = JSON.stringify(result)
  return new Response(
    `
      <html>
        <body>
          <script>
            const payload = ${payload};
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(payload, window.location.origin);
              window.close();
            } else {
              const params =
                payload.type === 'oauth-success'
                  ? 'connected=twitter'
                  : 'error=' + encodeURIComponent(payload.error || 'oauth_failed');
              window.location.href = '${appUrl}/dashboard/settings?' + params;
            }
          </script>
        </body>
      </html>
    `,
    {
      headers: {
        'Content-Type': 'text/html'
      }
    }
  )
}

export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 500 })
    }

    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const expectedState = req.cookies.get('twitter_oauth_state')?.value
    const codeVerifier = req.cookies.get('twitter_oauth_code_verifier')?.value
    const expectedUserId = req.cookies.get('twitter_oauth_user_id')?.value
    
    if (error) {
      return popupResponse(appUrl, { type: 'oauth-error', error })
    }
    
    if (!code || !state) {
      return popupResponse(appUrl, { type: 'oauth-error', error: 'missing_params' })
    }

    if (!expectedState || state !== expectedState || !codeVerifier) {
      return popupResponse(appUrl, { type: 'oauth-error', error: 'invalid_state' })
    }
    
    const { userId: currentUserId } = await auth()
    if (!currentUserId || (expectedUserId && currentUserId !== expectedUserId)) {
      return popupResponse(appUrl, { type: 'oauth-error', error: 'unauthorized' })
    }
    
    const clerkUserId = currentUserId
    
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
      return popupResponse(appUrl, { type: 'oauth-error', error: 'user_not_found' })
    }
    
    const userId = userData.id
    
    // Exchange code for access token
    const clientId = process.env.TWITTER_CLIENT_ID
    const clientSecret = process.env.TWITTER_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return popupResponse(appUrl, { type: 'oauth-error', error: 'oauth_not_configured' })
    }

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${appUrl}/api/oauth/twitter/callback`,
        code_verifier: codeVerifier
      })
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Twitter token exchange error:', errorData)
      return popupResponse(appUrl, { type: 'oauth-error', error: 'token_exchange_failed' })
    }
    
    const tokenData = await tokenResponse.json()
    
    // Get user info from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })
    
    if (!userResponse.ok) {
      console.error('Twitter user info error:', await userResponse.text())
      return popupResponse(appUrl, { type: 'oauth-error', error: 'user_info_failed' })
    }
    
    const userDataResponse = await userResponse.json()
    
    // Calculate token expiration
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 7200))
    
    // Store in database
    const { error: dbError } = await (supabaseAdmin
      .from('connected_accounts') as any)
      .upsert({
        user_id: userId,
        platform: 'twitter',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt.toISOString(),
        platform_user_id: userDataResponse.data?.id || null,
        account_username: userDataResponse.data?.username || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      })
    
    if (dbError) {
      console.error('Database error:', dbError)
      return popupResponse(appUrl, { type: 'oauth-error', error: 'db_error' })
    }
    
    const successResponse = popupResponse(appUrl, { type: 'oauth-success', platform: 'twitter' })
    successResponse.headers.append(
      'Set-Cookie',
      'twitter_oauth_state=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
    )
    successResponse.headers.append(
      'Set-Cookie',
      'twitter_oauth_code_verifier=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
    )
    successResponse.headers.append(
      'Set-Cookie',
      'twitter_oauth_user_id=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
    )
    return successResponse
    
  } catch (error) {
    console.error('Twitter OAuth callback error:', error)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (!appUrl) {
      return NextResponse.json({ error: 'OAuth callback failed' }, { status: 500 })
    }
    return popupResponse(appUrl, { type: 'oauth-error', error: 'callback_failed' })
  }
}
