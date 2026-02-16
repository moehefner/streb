import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Reddit OAuth 2.0 authorization URL
    const clientId = process.env.REDDIT_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/reddit/callback`
    const state = userId // Use userId as state for security

    // Reddit scopes (space-separated)
    const scope = 'identity submit read'

    // Build authorization URL
    const authUrl = new URL('https://www.reddit.com/api/v1/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('duration', 'permanent') // Permanent refresh token

    // Return authorization URL
    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('Reddit OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Reddit OAuth' },
      { status: 500 }
    )
  }
}
