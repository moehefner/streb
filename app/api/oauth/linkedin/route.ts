import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // LinkedIn OAuth 2.0 authorization URL
    const clientId = process.env.LINKEDIN_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/linkedin/callback`
    const state = userId // Use userId as state for security

    // LinkedIn scopes (space-separated)
    const scope = 'openid profile email w_member_social'

    // Build authorization URL
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('state', state)

    // Return authorization URL
    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('LinkedIn OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize LinkedIn OAuth' },
      { status: 500 }
    )
  }
}
