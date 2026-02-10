import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Threads OAuth 2.0 authorization URL
    const clientId = process.env.THREADS_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/threads/callback`
    const state = userId // Use userId as state for CSRF verification

    // Threads scopes for content publishing
    const scope = 'threads_basic,threads_content_publish'

    // Build authorization URL
    const authUrl = new URL('https://threads.net/oauth/authorize')
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
    console.error('Threads OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Threads OAuth' },
      { status: 500 }
    )
  }
}
