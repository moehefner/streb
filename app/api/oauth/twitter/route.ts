import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHash, randomBytes } from 'crypto'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.TWITTER_CLIENT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!clientId || !appUrl) {
      console.error('Twitter OAuth missing configuration')
      return NextResponse.json({ error: 'Twitter OAuth not configured' }, { status: 500 })
    }

    // Twitter OAuth 2.0 authorization URL
    const redirectUri = `${appUrl}/api/oauth/twitter/callback`
    const state = randomBytes(16).toString('hex')
    const codeVerifier = randomBytes(48).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    
    // Twitter OAuth 2.0 scopes
    const scopes = [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access' // For refresh tokens
    ].join(' ')
    
    // Build authorization URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    
    // Return authorization URL
    const response = NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

    response.cookies.set('twitter_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    })

    response.cookies.set('twitter_oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    })

    response.cookies.set('twitter_oauth_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    })

    return response
    
  } catch (error) {
    console.error('Twitter OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Twitter OAuth' },
      { status: 500 }
    )
  }
}
