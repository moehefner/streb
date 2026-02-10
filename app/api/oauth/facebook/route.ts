import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Facebook OAuth 2.0 authorization URL
    const clientId = process.env.FACEBOOK_APP_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/facebook/callback`
    const state = userId // Use userId as state for CSRF verification

    // Facebook scopes for page posting
    const scope = 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts'

    // Build authorization URL
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('response_type', 'code')

    // Return authorization URL
    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('Facebook OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Facebook OAuth' },
      { status: 500 }
    )
  }
}
