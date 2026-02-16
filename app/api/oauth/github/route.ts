import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GITHUB_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/github/callback`
    const state = userId // Use userId as state for CSRF verification

    // GitHub scopes for repo access (read access to public and private repos)
    const scope = 'repo user'

    const authUrl = new URL('https://github.com/login/oauth/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('state', state)

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('GitHub OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize GitHub OAuth' },
      { status: 500 }
    )
  }
}
