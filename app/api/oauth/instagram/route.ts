import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Instagram OAuth 2.0 authorization URL
    const clientId = process.env.INSTAGRAM_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/instagram/callback`
    const state = userId // Use userId as state for CSRF verification

    // Instagram scopes for content publishing
    const scope = 'instagram_basic,instagram_content_publish'

    // Build authorization URL
    const authUrl = new URL('https://api.instagram.com/oauth/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('state', state)

    // Return authorization URL
    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('Instagram OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Instagram OAuth' },
      { status: 500 }
    )
  }
}
